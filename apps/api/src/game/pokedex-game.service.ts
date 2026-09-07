import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import { HistoryService } from '../history/history.service';
import {
  DailyResultService,
  guestSessionFields,
  playerFromSession,
  type PlayerIdentity,
} from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import type {
  PokedexCell,
  PokedexDirection,
  PokedexGuessResponse,
  PokedexGuessRow,
  PokedexRoundState,
  PokedexVerdict,
} from '@pokegames/shared-types';

/** Fiche d'un Pokemon reduite aux six criteres compares par le jeu. */
interface PokedexEntry {
  id: number;
  nameFr: string;
  type1: string;
  type2: string | null;
  generation: number;
  evolutionStage: number;
  height: number; // metres
  weight: number; // kilos
}

interface PokedexSession {
  roundId: string;
  targetId: number;
  guessedIds: number[];
  status: 'PLAYING' | 'WON' | 'LOST';
  startTime: number;
  userId?: string;
  guestId?: string;
  guestName?: string;
}

const NO_TYPE_LABEL = 'Aucun';

/**
 * Le Pokedex : le joueur propose un Pokemon, le serveur compare six criteres avec la cible du jour
 * et renvoie un verdict par colonne. La cible ne quitte jamais Redis tant que la partie n'est pas
 * finie ; seuls le verdict et, sur les colonnes ordonnees, la direction sortent du serveur. Renvoyer
 * les valeurs de la cible permettrait de la reconstituer en deux essais.
 */
@Injectable()
export class PokedexGameService {
  private readonly REDIS_PREFIX = 'game_pokedex:';
  private readonly ROUND_TTL_SECONDS = 86_400; // le defi tient la journee entiere
  private readonly HISTORY_GAME = 'POKEDEX';
  private readonly RESULT_SCOPE = ''; // mode unique, pas de niveau

  private poolCache: PokedexEntry[] | null = null;
  private planCache: { date: string; targetId: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly history: HistoryService,
    private readonly dailyResult: DailyResultService,
    private readonly gameConfig: GameConfigService,
  ) {}

  /* ------------------------------------------------------------- Catalogue */

  private async loadPool(): Promise<PokedexEntry[]> {
    if (this.poolCache) return this.poolCache;
    const rows = await this.prisma.pokemon.findMany({
      // Les six criteres doivent etre comparables : sans taille ni poids, deux colonnes seraient vides.
      where: { height: { not: null }, weight: { not: null } },
      select: {
        id: true,
        nameFr: true,
        generation: true,
        evolutionStage: true,
        height: true,
        weight: true,
        types: {
          select: { slot: true, type: { select: { nameFr: true } } },
          orderBy: { slot: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    this.poolCache = rows
      .map((row) => {
        const first = row.types.find((t) => t.slot === 1) ?? row.types[0];
        const second = row.types.find((t) => t.slot === 2);
        if (!first) return null;
        return {
          id: row.id,
          nameFr: row.nameFr,
          type1: first.type.nameFr,
          type2: second?.type.nameFr ?? null,
          generation: row.generation,
          evolutionStage: row.evolutionStage,
          height: row.height ?? 0,
          weight: row.weight ?? 0,
        };
      })
      .filter((e): e is PokedexEntry => e !== null);
    return this.poolCache;
  }

  private makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private dailySeed(): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 137;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return seed || 1;
  }

  /** Cible du jour : identique pour tous, en evitant celles des jours precedents. */
  private async getDailyTarget(pool: PokedexEntry[]): Promise<PokedexEntry> {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    const cached = this.planCache;
    if (cached && cached.date === today) {
      const hit = pool.find((p) => p.id === cached.targetId);
      if (hit) return hit;
    }

    const now = new Date();
    const recentIds = await this.history.recentPokemonIds(
      this.HISTORY_GAME,
      this.RESULT_SCOPE,
      now,
      this.gameConfig.antiRepeatWindow(this.HISTORY_GAME),
    );
    const rng = this.makeRng(this.dailySeed());
    // Repli sur le catalogue complet si l'historique a tout exclu (pool devenu trop etroit).
    const eligible = pool.filter((p) => !recentIds.has(p.id));
    const source = eligible.length > 0 ? eligible : pool;
    const target = source[Math.floor(rng() * source.length)];
    if (!target) {
      throw new NotFoundException('Impossible de tirer le Pokémon du jour');
    }

    if (!(await this.history.hasPicksFor(this.HISTORY_GAME, this.RESULT_SCOPE, now))) {
      await this.history.recordPicks(this.HISTORY_GAME, this.RESULT_SCOPE, now, [
        { pokemonId: target.id },
      ]);
    }

    this.planCache = { date: today, targetId: target.id };
    return target;
  }

  /* --------------------------------------------------------------- Verdicts */

  /** Normalise un nom pour la comparaison : casse, accents et ponctuation neutralisees. */
  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD') // decompose les accents, que le filtre suivant retire
      .replace(/[^a-z0-9]/g, '');
  }

  private direction(guess: number, target: number): PokedexDirection | null {
    if (guess === target) return null;
    return target > guess ? 'HIGHER' : 'LOWER';
  }

  /**
   * Colonne ordonnee (generation, stade, taille, poids) : vert si egal, jaune si l'ecart tient dans
   * la tolerance, rouge au-dela. La fleche accompagne tout ce qui n'est pas vert : sans elle, un
   * rouge sur la taille ne dirait pas s'il faut chercher plus grand ou plus petit, et le verdict
   * serait indechiffrable pour un joueur qui ne distingue pas le rouge du vert.
   */
  private numericCell(label: string, guess: number, target: number, tolerance: number): PokedexCell {
    const gap = Math.abs(guess - target);
    const verdict: PokedexVerdict =
      gap === 0 ? 'CORRECT' : gap <= tolerance ? 'PARTIAL' : 'INCORRECT';
    return { label, verdict, direction: this.direction(guess, target) };
  }

  /** Tolerance du jaune : relative a la cible, avec un plancher absolu pour les petites valeurs. */
  private tolerance(target: number, pct: number, floor: number): number {
    return Math.max((target * pct) / 100, floor);
  }

  private formatHeight(m: number): string {
    // Sous le metre, les centimetres se lisent mieux. Virgule decimale et espace avant l'unite.
    if (m < 1) return `${Math.round(m * 100)} cm`;
    return `${m.toFixed(1).replace('.', ',')} m`;
  }

  private formatWeight(kg: number): string {
    return `${kg.toFixed(1).replace('.', ',')} kg`;
  }

  private buildRow(guess: PokedexEntry, target: PokedexEntry): PokedexGuessRow {
    const cfg = this.gameConfig.pokedex();

    // Type 1 : jaune si ce type existe chez la cible, mais dans l'autre emplacement.
    const type1: PokedexCell = {
      label: guess.type1,
      verdict:
        guess.type1 === target.type1
          ? 'CORRECT'
          : guess.type1 === target.type2
            ? 'PARTIAL'
            : 'INCORRECT',
      direction: null,
    };

    // Type 2 : "Aucun" des deux cotes est une vraie correspondance (500 Pokemon sont mono-type).
    const type2: PokedexCell = {
      label: guess.type2 ?? NO_TYPE_LABEL,
      verdict:
        guess.type2 === target.type2
          ? 'CORRECT'
          : guess.type2 !== null && guess.type2 === target.type1
            ? 'PARTIAL'
            : 'INCORRECT',
      direction: null,
    };

    // Generation : binaire, mais la fleche indique de quel cote chercher.
    const generation: PokedexCell = {
      label: `Gen ${guess.generation}`,
      verdict: guess.generation === target.generation ? 'CORRECT' : 'INCORRECT',
      direction: this.direction(guess.generation, target.generation),
    };

    // Stade d'evolution : jaune a un stade d'ecart, rouge a deux.
    const evolutionStage = this.numericCell(
      String(guess.evolutionStage),
      guess.evolutionStage,
      target.evolutionStage,
      1,
    );

    const height = this.numericCell(
      this.formatHeight(guess.height),
      guess.height,
      target.height,
      this.tolerance(target.height, cfg.heightTolerancePct, cfg.heightToleranceMinM),
    );

    const weight = this.numericCell(
      this.formatWeight(guess.weight),
      guess.weight,
      target.weight,
      this.tolerance(target.weight, cfg.weightTolerancePct, cfg.weightToleranceMinKg),
    );

    return {
      pokemonId: guess.id,
      nameFr: guess.nameFr,
      spriteUrl: `/api/pokemon/${guess.id}/sprite`,
      type1,
      type2,
      generation,
      evolutionStage,
      height,
      weight,
    };
  }

  /* ------------------------------------------------------------------ Etat */

  private async toState(session: PokedexSession): Promise<PokedexRoundState> {
    const pool = await this.loadPool();
    const byId = new Map(pool.map((p) => [p.id, p]));
    const target = byId.get(session.targetId);
    if (!target) {
      throw new NotFoundException('Pokémon du jour introuvable');
    }

    // Ligne la plus recente en tete : le joueur lit son dernier essai sans faire defiler.
    const guesses = [...session.guessedIds]
      .reverse()
      .map((id) => byId.get(id))
      .filter((g): g is PokedexEntry => g !== undefined)
      .map((g) => this.buildRow(g, target));

    const finished = session.status !== 'PLAYING';
    return {
      roundId: session.roundId,
      status: session.status,
      maxAttempts: this.gameConfig.pokedex().maxAttempts,
      attemptsUsed: session.guessedIds.length,
      guesses,
      answer: finished
        ? {
            pokemonId: target.id,
            nameFr: target.nameFr,
            spriteUrl: `/api/pokemon/${target.id}/sprite`,
          }
        : null,
    };
  }

  private async persist(session: PokedexSession): Promise<void> {
    await this.redisService.set(
      `${this.REDIS_PREFIX}${session.roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );
  }

  private async load(roundId: string): Promise<PokedexSession> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return JSON.parse(raw) as PokedexSession;
  }

  /* --------------------------------------------------------------- Actions */

  async startDaily(player: PlayerIdentity = {}): Promise<PokedexRoundState> {
    const userId = player.userId;
    if (
      userId &&
      (await this.dailyResult.hasCompleted(userId, this.HISTORY_GAME, this.RESULT_SCOPE, new Date()))
    ) {
      throw new ConflictException('DAILY_ALREADY_COMPLETED');
    }

    const pool = await this.loadPool();
    if (pool.length === 0) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const target = await this.getDailyTarget(pool);

    const session: PokedexSession = {
      roundId: uuidv4(),
      targetId: target.id,
      guessedIds: [],
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : guestSessionFields(player)),
    };
    await this.persist(session);
    return this.toState(session);
  }

  async getRoundState(roundId: string): Promise<PokedexRoundState> {
    return this.toState(await this.load(roundId));
  }

  async guess(roundId: string, name: string, userId?: string): Promise<PokedexGuessResponse> {
    const session = await this.load(roundId);
    if (session.status !== 'PLAYING') {
      throw new BadRequestException('Cette partie est déjà terminée');
    }
    if (userId && !session.userId) session.userId = userId;

    const pool = await this.loadPool();
    const wanted = this.normalize(name);
    const guess = pool.find((p) => this.normalize(p.nameFr) === wanted);

    // Proposition invalide ou deja jouee : aucun essai consomme, l'etat ne bouge pas.
    if (!guess) {
      return {
        accepted: false,
        message: 'Ce Pokémon n’existe pas.',
        state: await this.toState(session),
      };
    }
    if (session.guessedIds.includes(guess.id)) {
      return {
        accepted: false,
        message: 'Tu as déjà proposé ce Pokémon.',
        state: await this.toState(session),
      };
    }

    session.guessedIds.push(guess.id);
    const won = guess.id === session.targetId;
    const outOfAttempts = session.guessedIds.length >= this.gameConfig.pokedex().maxAttempts;
    if (won) {
      session.status = 'WON';
    } else if (outOfAttempts) {
      session.status = 'LOST';
    }

    await this.persist(session);

    if (session.status !== 'PLAYING') {
      await this.finalize(session, guess.nameFr);
    }

    return { accepted: true, state: await this.toState(session) };
  }

  /** Cloture : audit asynchrone (Regle 5) puis enregistrement du resultat du jour. */
  private async finalize(session: PokedexSession, lastGuess: string): Promise<void> {
    const pool = await this.loadPool();
    const target = pool.find((p) => p.id === session.targetId);
    if (!target) return;

    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
    const won = session.status === 'WON';

    this.eventEmitter.emit(
      'game.round.completed',
      new GameRoundCompletedEvent(
        session.roundId,
        'POKEDEX',
        target.id,
        target.nameFr,
        won,
        durationSeconds,
        0,
        0,
        lastGuess,
        session.userId,
      ),
    );

    const player: PlayerIdentity = playerFromSession(session);
    if (player.userId || player.guestId) {
      await this.dailyResult.record(player, this.HISTORY_GAME, this.RESULT_SCOPE, new Date(), {
        won,
        attempts: session.guessedIds.length,
        durationSeconds,
      });
    }
  }
}
