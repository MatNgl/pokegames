import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  GUESS_WHO_EVENTS,
  type GuessWhoCard,
  type GuessWhoPhase,
  type GuessWhoStateDTO,
} from '@pokegames/shared-types';

const GRID_SIZE = 25;
// Minuteur par phase (ms) : poser la question, y repondre, puis analyser/eliminer.
const PHASE_MS: Record<GuessWhoPhase, number> = {
  ASKING: 30_000,
  ANSWERING: 30_000,
  ELIMINATING: 20_000,
};

export interface Emit {
  socketId: string;
  event: string;
  payload: unknown;
}

interface Player {
  userId: string;
  username: string;
  socketId: string;
  secret: number;
}

interface Game {
  id: string;
  cards: GuessWhoCard[];
  players: [Player, Player];
  activeIndex: 0 | 1; // joueur dont c'est le tour (celui qui pose / elimine)
  phase: GuessWhoPhase;
  currentQuestion: string | null;
  turnDeadline: number | null;
  turnToken: number; // invalide les minuteurs perimes
  status: 'PLAYING' | 'FINISHED';
}

interface Waiting {
  userId: string;
  username: string;
  socketId: string;
}

@Injectable()
export class GuessWhoService {
  private readonly games = new Map<string, Game>();
  private readonly bySocket = new Map<string, string>(); // socketId -> gameId
  private queue: Waiting | null = null; // file d'attente (un seul en attente a la fois)
  private readonly rooms = new Map<string, Waiting>(); // code -> hote en attente
  private poolCache: GuessWhoCard[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Programme la fin de tour (minuteur d'elimination) : le gateway rappelle expireTurn. */
  onScheduleExpire?: (gameId: string, token: number, delayMs: number) => void;

  private async loadPool(): Promise<GuessWhoCard[]> {
    if (this.poolCache) return this.poolCache;
    const rows = await this.prisma.pokemon.findMany({ select: { id: true, nameFr: true } });
    this.poolCache = rows.map((r) => ({ pokemonId: r.id, name: r.nameFr }));
    return this.poolCache;
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  }

  private stateFor(game: Game, index: 0 | 1): GuessWhoStateDTO {
    const me = game.players[index];
    const opp = game.players[index === 0 ? 1 : 0];
    return {
      gameId: game.id,
      grid: game.cards,
      yourSecretPokemonId: me.secret,
      opponentName: opp.username,
      phase: game.phase,
      yourTurn: game.activeIndex === index,
      currentQuestion: game.currentQuestion,
      turnDeadline: game.turnDeadline,
    };
  }

  private bothStates(game: Game): Emit[] {
    return [
      { socketId: game.players[0].socketId, event: GUESS_WHO_EVENTS.state, payload: this.stateFor(game, 0) },
      { socketId: game.players[1].socketId, event: GUESS_WHO_EVENTS.state, payload: this.stateFor(game, 1) },
    ];
  }

  // Entre dans une phase : fixe l'echeance, invalide les minuteurs perimes et en programme un nouveau.
  private beginPhase(game: Game, phase: GuessWhoPhase): void {
    game.phase = phase;
    game.turnToken += 1;
    game.turnDeadline = Date.now() + PHASE_MS[phase];
    this.onScheduleExpire?.(game.id, game.turnToken, PHASE_MS[phase]);
  }

  private switchTurn(game: Game): void {
    game.activeIndex = game.activeIndex === 0 ? 1 : 0;
  }

  private async startGame(a: Waiting, b: Waiting): Promise<Emit[]> {
    const pool = await this.loadPool();
    if (pool.length < GRID_SIZE) {
      return [{ socketId: a.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Catalogue insuffisant.' } }];
    }
    const cards = this.shuffle(pool).slice(0, GRID_SIZE);
    const secretA = cards[Math.floor(Math.random() * GRID_SIZE)]?.pokemonId ?? cards[0]!.pokemonId;
    const secretB = cards[Math.floor(Math.random() * GRID_SIZE)]?.pokemonId ?? cards[0]!.pokemonId;
    const game: Game = {
      id: uuidv4(),
      cards,
      players: [
        { ...a, secret: secretA },
        { ...b, secret: secretB },
      ],
      activeIndex: 0,
      phase: 'ASKING',
      currentQuestion: null,
      turnDeadline: null,
      turnToken: 0,
      status: 'PLAYING',
    };
    this.games.set(game.id, game);
    this.bySocket.set(a.socketId, game.id);
    this.bySocket.set(b.socketId, game.id);
    this.beginPhase(game, 'ASKING');
    return this.bothStates(game);
  }

  async joinQueue(user: Waiting): Promise<Emit[]> {
    if (this.queue && this.queue.socketId !== user.socketId) {
      const opponent = this.queue;
      this.queue = null;
      return this.startGame(opponent, user);
    }
    this.queue = user;
    return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.waiting, payload: {} }];
  }

  createRoom(user: Waiting): Emit[] {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.rooms.set(code, user);
    return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.roomCreated, payload: { code } }];
  }

  async joinRoom(code: string, user: Waiting): Promise<Emit[]> {
    const host = this.rooms.get(code.toUpperCase());
    if (!host) {
      return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Salon introuvable.' } }];
    }
    if (host.socketId === user.socketId) {
      return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Tu ne peux pas rejoindre ton propre salon.' } }];
    }
    this.rooms.delete(code.toUpperCase());
    return this.startGame(host, user);
  }

  cancel(socketId: string): void {
    if (this.queue?.socketId === socketId) this.queue = null;
    for (const [code, host] of this.rooms) {
      if (host.socketId === socketId) this.rooms.delete(code);
    }
  }

  private findGame(socketId: string): { game: Game; index: 0 | 1 } | null {
    const gameId = this.bySocket.get(socketId);
    if (!gameId) return null;
    const game = this.games.get(gameId);
    if (!game) return null;
    const index = game.players[0].socketId === socketId ? 0 : 1;
    return { game, index };
  }

  ask(socketId: string, text: string): Emit[] {
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    if (game.status !== 'PLAYING' || game.activeIndex !== index || game.phase !== 'ASKING') return [];
    const clean = text.trim().slice(0, 200);
    if (!clean) return [];
    game.currentQuestion = clean;
    this.beginPhase(game, 'ANSWERING');
    const opp = game.players[index === 0 ? 1 : 0];
    return [
      { socketId: opp.socketId, event: GUESS_WHO_EVENTS.question, payload: { text: clean } },
      ...this.bothStates(game),
    ];
  }

  answer(socketId: string, value: boolean): Emit[] {
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    // C'est l'adversaire (non actif) qui repond.
    if (game.status !== 'PLAYING' || game.phase !== 'ANSWERING' || game.activeIndex === index) return [];
    const asker = game.players[game.activeIndex];
    this.beginPhase(game, 'ELIMINATING');
    return [
      { socketId: asker.socketId, event: GUESS_WHO_EVENTS.answered, payload: { value } },
      ...this.bothStates(game),
    ];
  }

  /** Fin du minuteur d'une phase : fait avancer la machine a etats selon la phase courante. */
  expire(gameId: string, token: number): Emit[] {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'PLAYING' || game.turnToken !== token) {
      return [];
    }
    if (game.phase === 'ASKING') {
      // Le joueur actif n'a pas pose sa question a temps : la main passe a l'adversaire.
      this.switchTurn(game);
      game.currentQuestion = null;
      this.beginPhase(game, 'ASKING');
      return this.bothStates(game);
    }
    if (game.phase === 'ANSWERING') {
      // L'adversaire n'a pas repondu : aucune reponse, on passe a l'elimination.
      const asker = game.players[game.activeIndex];
      this.beginPhase(game, 'ELIMINATING');
      return [
        { socketId: asker.socketId, event: GUESS_WHO_EVENTS.answered, payload: { value: null } },
        ...this.bothStates(game),
      ];
    }
    // ELIMINATING : fin du tour, on passe la main.
    this.switchTurn(game);
    game.currentQuestion = null;
    this.beginPhase(game, 'ASKING');
    return this.bothStates(game);
  }

  private endGame(game: Game, winnerIndex: 0 | 1, reason: 'GUESS' | 'FORFEIT'): Emit[] {
    game.status = 'FINISHED';
    game.turnToken += 1;
    const emits: Emit[] = [];
    for (const idx of [0, 1] as const) {
      const me = game.players[idx];
      const opp = game.players[idx === 0 ? 1 : 0];
      emits.push({
        socketId: me.socketId,
        event: GUESS_WHO_EVENTS.over,
        payload: {
          youWon: idx === winnerIndex,
          winnerName: game.players[winnerIndex].username,
          yourSecretPokemonId: me.secret,
          opponentSecretPokemonId: opp.secret,
          reason,
        },
      });
    }
    this.bySocket.delete(game.players[0].socketId);
    this.bySocket.delete(game.players[1].socketId);
    this.games.delete(game.id);
    return emits;
  }

  finalGuess(socketId: string, pokemonId: number): Emit[] {
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    // Reponse finale autorisee seulement a son tour et avant d'avoir pose sa question (phase ASKING).
    if (game.status !== 'PLAYING' || game.activeIndex !== index || game.phase !== 'ASKING') return [];
    const opponent = game.players[index === 0 ? 1 : 0];
    const correct = opponent.secret === pokemonId;
    const winnerIndex: 0 | 1 = correct ? index : (index === 0 ? 1 : 0);
    return this.endGame(game, winnerIndex, 'GUESS');
  }

  handleDisconnect(socketId: string): Emit[] {
    this.cancel(socketId);
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    if (game.status !== 'PLAYING') return [];
    // L'adversaire (celui qui reste) gagne par forfait.
    const winnerIndex: 0 | 1 = index === 0 ? 1 : 0;
    return this.endGame(game, winnerIndex, 'FORFEIT');
  }
}
