import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { GameConfigService } from '../game-config/game-config.service';
import {
  GUESS_WHO_EVENTS,
  type GuessWhoCard,
  type GuessWhoPhase,
  type GuessWhoStateDTO,
} from '@pokegames/shared-types';

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
  connected: boolean;
  disconnectToken: number; // invalide un forfait en attente si le joueur se reconnecte
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

  // Delai de grace avant forfait : couvre un reload de page ou une coupure reseau transitoire.
  private readonly RECONNECT_GRACE_MS = 15000;
  // Temps de preparation avant le 1er tour (revelation du secret), aligne avec l'intro du front.
  private readonly INTRO_MS = 4000;
  // Caracteres non ambigus pour les codes de salon (pas de I, O, 0, 1).
  private static readonly ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameConfig: GameConfigService,
  ) {}

  /** Programme la fin de tour (minuteur d'elimination) : le gateway rappelle expireTurn. */
  onScheduleExpire?: (gameId: string, token: number, delayMs: number) => void;

  /** Programme un forfait differe apres deconnexion : le gateway rappelle forfeitIfStillGone. */
  onScheduleForfeit?: (gameId: string, index: 0 | 1, token: number, delayMs: number) => void;

  /** Programme le demarrage du 1er tour apres l'intro : le gateway rappelle startFirstTurn. */
  onScheduleStart?: (gameId: string, delayMs: number) => void;

  /** Signale la fin d'une partie : le gateway purge les minuteurs en attente pour cette partie. */
  onGameEnd?: (gameId: string) => void;

  // Minuteur d'une phase (ms), lu depuis la config dynamique.
  private phaseMs(phase: GuessWhoPhase): number {
    return this.gameConfig.guessWho().phaseSeconds[phase] * 1000;
  }

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
    const delay = this.phaseMs(phase);
    game.turnDeadline = Date.now() + delay;
    this.onScheduleExpire?.(game.id, game.turnToken, delay);
  }

  private switchTurn(game: Game): void {
    game.activeIndex = game.activeIndex === 0 ? 1 : 0;
  }

  private async startGame(a: Waiting, b: Waiting): Promise<Emit[]> {
    // Les deux joueurs quittent toute file/salon en attente avant de demarrer.
    this.cancel(a.socketId);
    this.cancel(b.socketId);
    const pool = await this.loadPool();
    const gridSize = this.gameConfig.guessWho().gridSize;
    if (pool.length < gridSize) {
      // Les deux joueurs doivent etre notifies, sinon l'un reste bloque sans feedback.
      const message = 'Catalogue insuffisant pour lancer une partie.';
      return [
        { socketId: a.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message } },
        { socketId: b.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message } },
      ];
    }
    const cards = this.shuffle(pool).slice(0, gridSize);
    const secretA = cards[Math.floor(Math.random() * gridSize)]?.pokemonId ?? cards[0]!.pokemonId;
    const secretB = cards[Math.floor(Math.random() * gridSize)]?.pokemonId ?? cards[0]!.pokemonId;
    const game: Game = {
      id: uuidv4(),
      cards,
      players: [
        { ...a, secret: secretA, connected: true, disconnectToken: 0 },
        { ...b, secret: secretB, connected: true, disconnectToken: 0 },
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
    // Le 1er tour ne demarre qu'apres l'intro : le joueur actif ne perd pas ses premieres secondes.
    // turnDeadline reste null (aucun minuteur affiche) le temps de la revelation du secret.
    this.onScheduleStart?.(game.id, this.INTRO_MS);
    return this.bothStates(game);
  }

  /** Demarre le 1er tour apres l'intro (no-op si une action l'a deja demarre ou si la partie est finie). */
  startFirstTurn(gameId: string): Emit[] {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'PLAYING' || game.turnToken !== 0) return [];
    this.beginPhase(game, 'ASKING');
    return this.bothStates(game);
  }

  // Un socket deja engage dans une partie ne peut pas relancer un matchmaking (evite d'etre dans deux parties).
  private alreadyInGame(socketId: string): Emit[] | null {
    if (this.bySocket.has(socketId)) {
      return [{ socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Tu es déjà dans une partie.' } }];
    }
    return null;
  }

  private generateRoomCode(): string {
    const alphabet = GuessWhoService.ROOM_CODE_ALPHABET;
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  async joinQueue(user: Waiting): Promise<Emit[]> {
    const busy = this.alreadyInGame(user.socketId);
    if (busy) return busy;
    // Retire un eventuel salon en attente de ce joueur pour ne pas laisser d'orphelin.
    this.cancel(user.socketId);
    if (this.queue && this.queue.socketId !== user.socketId) {
      const opponent = this.queue;
      this.queue = null;
      return this.startGame(opponent, user);
    }
    this.queue = user;
    return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.waiting, payload: {} }];
  }

  createRoom(user: Waiting): Emit[] {
    const busy = this.alreadyInGame(user.socketId);
    if (busy) return busy;
    // Un seul salon/file par joueur : on nettoie l'etat precedent avant d'en creer un nouveau.
    this.cancel(user.socketId);
    const code = this.generateRoomCode();
    this.rooms.set(code, user);
    return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.roomCreated, payload: { code } }];
  }

  async joinRoom(code: string, user: Waiting): Promise<Emit[]> {
    const busy = this.alreadyInGame(user.socketId);
    if (busy) return busy;
    const host = this.rooms.get(code.toUpperCase());
    if (!host) {
      return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Salon introuvable.' } }];
    }
    if (host.socketId === user.socketId) {
      return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.errorMsg, payload: { message: 'Tu ne peux pas rejoindre ton propre salon.' } }];
    }
    this.rooms.delete(code.toUpperCase());
    // Retire une eventuelle file/salon du joueur qui rejoint.
    this.cancel(user.socketId);
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

  /** Le joueur actif clot sa phase d'elimination en avance et passe la main. */
  endTurn(socketId: string): Emit[] {
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    if (game.status !== 'PLAYING' || game.activeIndex !== index || game.phase !== 'ELIMINATING') return [];
    this.switchTurn(game);
    game.currentQuestion = null;
    this.beginPhase(game, 'ASKING');
    return this.bothStates(game);
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
    // Purge les minuteurs (phase, forfait, intro) encore programmes pour cette partie.
    this.onGameEnd?.(game.id);
    return emits;
  }

  finalGuess(socketId: string, pokemonId: number): Emit[] {
    const found = this.findGame(socketId);
    if (!found) return [];
    const { game, index } = found;
    // Reponse finale autorisee seulement a son tour et avant d'avoir pose sa question (phase ASKING).
    if (game.status !== 'PLAYING' || game.activeIndex !== index || game.phase !== 'ASKING') return [];
    // L'id doit appartenir a la grille (rejette une entree hors plateau).
    if (!game.cards.some((c) => c.pokemonId === pokemonId)) return [];
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
    // On ne forfait pas immediatement : un reload ou une coupure transitoire doit pouvoir se reconnecter.
    const player = game.players[index];
    player.connected = false;
    player.disconnectToken += 1;
    // Le socket mort ne doit plus recevoir d'emissions ; on retire son mapping.
    this.bySocket.delete(socketId);
    this.onScheduleForfeit?.(game.id, index, player.disconnectToken, this.RECONNECT_GRACE_MS);
    return [];
  }

  /** Fin du delai de grace : forfait si le joueur ne s'est pas reconnecte entre-temps. */
  forfeitIfStillGone(gameId: string, index: 0 | 1, token: number): Emit[] {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'PLAYING') return [];
    const player = game.players[index];
    // Reconnecte (connected) ou nouveau cycle de deconnexion (token perime) : on ne forfait pas.
    if (player.connected || player.disconnectToken !== token) return [];
    const winnerIndex: 0 | 1 = index === 0 ? 1 : 0;
    return this.endGame(game, winnerIndex, 'FORFEIT');
  }

  /** Reconnexion d'un joueur (nouveau socket, meme userId) a sa partie en cours. */
  reconnect(user: Waiting): Emit[] {
    for (const game of this.games.values()) {
      if (game.status !== 'PLAYING') continue;
      const found = game.players.findIndex((p) => p.userId === user.userId);
      if (found === -1) continue;
      const index = found as 0 | 1;
      const player = game.players[index];
      // Rebranche le nouveau socket et invalide le forfait en attente.
      this.bySocket.delete(player.socketId);
      player.socketId = user.socketId;
      player.username = user.username;
      player.connected = true;
      player.disconnectToken += 1;
      this.bySocket.set(user.socketId, game.id);
      return [{ socketId: user.socketId, event: GUESS_WHO_EVENTS.state, payload: this.stateFor(game, index) }];
    }
    return [];
  }
}
