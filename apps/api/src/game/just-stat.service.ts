import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import { JUST_STAT_CONFIG, JUST_STAT_DESCRIPTORS } from './game-config';
import type {
  JustStatDirection,
  JustStatGuessResponse,
  JustStatKey,
  JustStatRoundState,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  name: string;
  hp: number;
  atk: number;
  def: number;
  speAtk: number;
  speDef: number;
  speed: number;
  heightCm: number;
  weightKg: number;
}

interface RoundDef {
  pokemonId: number;
  name: string;
  stat: JustStatKey;
  value: number;
  attemptsUsed: number;
  solved: boolean;
  over: boolean;
}

interface JustStatSession {
  roundId: string;
  rounds: RoundDef[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
}

@Injectable()
export class JustStatService {
  private readonly REDIS_PREFIX = 'game_juststat:';
  private readonly ROUND_TTL_SECONDS = 3600;

  private poolCache: PoolPokemon[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async loadPool(): Promise<PoolPokemon[]> {
    if (this.poolCache) return this.poolCache;
    // Taille et poids requis : toutes les stats des 8 doivent etre calculables pour chaque Pokemon.
    const rows = await this.prisma.pokemon.findMany({
      where: { height: { not: null }, weight: { not: null } },
      select: {
        id: true,
        nameFr: true,
        statsHp: true,
        statsAtk: true,
        statsDef: true,
        statsSpeAtk: true,
        statsSpeDef: true,
        statsSpeed: true,
        height: true,
        weight: true,
      },
      orderBy: { id: 'asc' },
    });
    this.poolCache = rows.map((row) => ({
      id: row.id,
      name: row.nameFr,
      hp: row.statsHp,
      atk: row.statsAtk,
      def: row.statsDef,
      speAtk: row.statsSpeAtk,
      speDef: row.statsSpeDef,
      speed: row.statsSpeed,
      heightCm: Math.round((row.height ?? 0) * 100),
      weightKg: Math.round(row.weight ?? 0),
    }));
    return this.poolCache;
  }

  private statValue(p: PoolPokemon, stat: JustStatKey): number {
    switch (stat) {
      case 'HP':
        return p.hp;
      case 'ATK':
        return p.atk;
      case 'DEF':
        return p.def;
      case 'SPE_ATK':
        return p.speAtk;
      case 'SPE_DEF':
        return p.speDef;
      case 'SPEED':
        return p.speed;
      case 'HEIGHT_CM':
        return p.heightCm;
      case 'WEIGHT_KG':
        return p.weightKg;
      default:
        return 0;
    }
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
    let seed = 91;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return seed || 1;
  }

  private shuffle<T>(items: T[], rng: () => number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  }

  private buildRounds(pool: PoolPokemon[], rng: () => number): RoundDef[] {
    const count = JUST_STAT_CONFIG.roundsCount;
    // Variete intra-session : stats distinctes et Pokemon distincts sur les manches du jour.
    const stats = this.shuffle(JUST_STAT_CONFIG.allowedStats, rng).slice(0, count);
    const pokemons = this.shuffle(pool, rng).slice(0, count);
    const rounds: RoundDef[] = [];
    for (let i = 0; i < count; i++) {
      const p = pokemons[i];
      const stat = stats[i] ?? stats[stats.length - 1];
      if (!p || !stat) continue;
      rounds.push({
        pokemonId: p.id,
        name: p.name,
        stat,
        value: this.statValue(p, stat),
        attemptsUsed: 0,
        solved: false,
        over: false,
      });
    }
    return rounds;
  }

  private toState(session: JustStatSession): JustStatRoundState {
    const total = session.rounds.length;
    const idx = session.status === 'FINISHED' ? total - 1 : session.currentIndex;
    const round = session.rounds[idx];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }
    const descriptor = JUST_STAT_DESCRIPTORS[round.stat];
    return {
      roundId: session.roundId,
      totalRounds: total,
      roundIndex: Math.min(session.currentIndex + 1, total),
      correctCount: session.correctCount,
      status: session.status,
      pokemon: {
        id: round.pokemonId,
        name: round.name,
        spriteUrl: `/api/pokemon/${round.pokemonId}/sprite`,
      },
      stat: round.stat,
      statLabel: descriptor.label,
      statUnit: descriptor.unit,
      min: descriptor.min,
      max: descriptor.max,
      timeLimitSeconds: JUST_STAT_CONFIG.timeLimitSeconds,
      maxAttempts: JUST_STAT_CONFIG.maxAttempts,
      attemptsRemaining: Math.max(0, JUST_STAT_CONFIG.maxAttempts - round.attemptsUsed),
    };
  }

  async startDaily(userId?: string): Promise<JustStatRoundState> {
    const pool = await this.loadPool();
    if (pool.length < JUST_STAT_CONFIG.roundsCount) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const rounds = this.buildRounds(pool, this.makeRng(this.dailySeed()));
    if (rounds.length === 0) {
      throw new NotFoundException('Impossible de générer les manches du jour');
    }

    const roundId = uuidv4();
    const session: JustStatSession = {
      roundId,
      rounds,
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : {}),
    };
    await this.persist(session);
    return this.toState(session);
  }

  async getRoundState(roundId: string): Promise<JustStatRoundState> {
    return this.toState(await this.load(roundId));
  }

  private async load(roundId: string): Promise<JustStatSession> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return JSON.parse(raw) as JustStatSession;
  }

  private async persist(session: JustStatSession): Promise<void> {
    await this.redisService.set(
      `${this.REDIS_PREFIX}${session.roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );
  }

  private advanceAndMaybeFinish(session: JustStatSession, round: RoundDef): void {
    round.over = true;
    session.currentIndex += 1;
    if (session.currentIndex >= session.rounds.length) {
      session.status = 'FINISHED';
      this.emitCompleted(session, round);
    }
  }

  private emitCompleted(session: JustStatSession, lastRound: RoundDef): void {
    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
    this.eventEmitter.emit(
      'game.round.completed',
      new GameRoundCompletedEvent(
        session.roundId,
        'JUST_STAT',
        lastRound.pokemonId,
        lastRound.name,
        session.correctCount === session.rounds.length,
        durationSeconds,
        0,
        session.correctCount,
        undefined,
        session.userId,
        false,
      ),
    );
  }

  private endedResponse(session: JustStatSession, round: RoundDef): JustStatGuessResponse {
    return {
      direction: round.solved ? 'CORRECT' : null,
      attemptsRemaining: Math.max(0, JUST_STAT_CONFIG.maxAttempts - round.attemptsUsed),
      roundOver: true,
      correctValue: round.value,
      state: this.toState(session),
    };
  }

  async guess(
    roundId: string,
    guessValue: number,
    userId?: string,
  ): Promise<JustStatGuessResponse> {
    if (!Number.isFinite(guessValue)) {
      throw new BadRequestException('Valeur invalide');
    }
    const session = await this.load(roundId);
    if (userId && !session.userId) session.userId = userId;
    const playedIndex = Math.min(session.currentIndex, session.rounds.length - 1);
    const round = session.rounds[playedIndex];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }
    if (session.status !== 'PLAYING' || round.over) {
      return this.endedResponse(session, round);
    }

    const guess = Math.round(guessValue);
    round.attemptsUsed += 1;

    let direction: JustStatDirection;
    if (guess === round.value) {
      direction = 'CORRECT';
      round.solved = true;
      session.correctCount += 1;
      this.advanceAndMaybeFinish(session, round);
    } else {
      direction = guess < round.value ? 'HIGHER' : 'LOWER';
      if (round.attemptsUsed >= JUST_STAT_CONFIG.maxAttempts) {
        this.advanceAndMaybeFinish(session, round);
      }
    }

    await this.persist(session);

    return {
      direction,
      attemptsRemaining: Math.max(0, JUST_STAT_CONFIG.maxAttempts - round.attemptsUsed),
      roundOver: round.over,
      correctValue: round.over ? round.value : null,
      state: this.toState(session),
    };
  }

  async timeout(roundId: string, userId?: string): Promise<JustStatGuessResponse> {
    const session = await this.load(roundId);
    if (userId && !session.userId) session.userId = userId;
    const playedIndex = Math.min(session.currentIndex, session.rounds.length - 1);
    const round = session.rounds[playedIndex];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }
    if (session.status !== 'PLAYING' || round.over) {
      return this.endedResponse(session, round);
    }

    this.advanceAndMaybeFinish(session, round);
    await this.persist(session);

    return {
      direction: null,
      attemptsRemaining: Math.max(0, JUST_STAT_CONFIG.maxAttempts - round.attemptsUsed),
      roundOver: true,
      correctValue: round.value,
      state: this.toState(session),
    };
  }
}
