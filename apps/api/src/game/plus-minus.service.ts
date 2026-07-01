import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import type {
  PlusMinusChoiceResponse,
  PlusMinusContestant,
  PlusMinusCriterion,
  PlusMinusReveal,
  PlusMinusRoundState,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  pokedexId: number;
  name: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  height: number | null;
  weight: number | null;
}

interface DuelSide {
  id: number;
  name: string;
  value: number;
}

interface Duel {
  criterion: PlusMinusCriterion;
  a: DuelSide;
  b: DuelSide;
  correct: 'A' | 'B';
}

interface PlusMinusSession {
  roundId: string;
  duels: Duel[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
}

const CRITERIA: PlusMinusCriterion[] = ['HP', 'HEIGHT', 'WEIGHT', 'ATK', 'DEF', 'SPEED', 'AGE'];

@Injectable()
export class PlusMinusService {
  private readonly REDIS_PREFIX = 'game_plusminus:';
  private readonly ROUND_TTL_SECONDS = 3600;
  private readonly TOTAL_ROUNDS = 10;

  private poolCache: PoolPokemon[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async loadPool(): Promise<PoolPokemon[]> {
    if (this.poolCache) return this.poolCache;
    const rows = await this.prisma.pokemon.findMany({
      select: {
        id: true,
        pokedexId: true,
        nameFr: true,
        statsHp: true,
        statsAtk: true,
        statsDef: true,
        statsSpeed: true,
        height: true,
        weight: true,
      },
      orderBy: { id: 'asc' },
    });
    this.poolCache = rows.map((row) => ({
      id: row.id,
      pokedexId: row.pokedexId,
      name: row.nameFr,
      hp: row.statsHp,
      atk: row.statsAtk,
      def: row.statsDef,
      speed: row.statsSpeed,
      height: row.height,
      weight: row.weight,
    }));
    return this.poolCache;
  }

  private value(criterion: PlusMinusCriterion, p: PoolPokemon): number | null {
    switch (criterion) {
      case 'HP':
        return p.hp;
      case 'ATK':
        return p.atk;
      case 'DEF':
        return p.def;
      case 'SPEED':
        return p.speed;
      case 'HEIGHT':
        return p.height;
      case 'WEIGHT':
        return p.weight;
      case 'AGE':
        return p.pokedexId;
      default:
        return null;
    }
  }

  private higherWins(criterion: PlusMinusCriterion): boolean {
    // Pour l'anciennete, le plus ancien est le plus petit numero de Pokedex.
    return criterion !== 'AGE';
  }

  private criterionLabel(criterion: PlusMinusCriterion): string {
    switch (criterion) {
      case 'HP':
        return 'Qui a le plus de PV ?';
      case 'ATK':
        return "Qui a le plus d'Attaque ?";
      case 'DEF':
        return 'Qui a le plus de Défense ?';
      case 'SPEED':
        return 'Qui a le plus de Vitesse ?';
      case 'HEIGHT':
        return 'Lequel est le plus grand ?';
      case 'WEIGHT':
        return 'Lequel est le plus lourd ?';
      case 'AGE':
        return 'Lequel est le plus ancien ?';
      default:
        return 'Lequel a la plus grande valeur ?';
    }
  }

  private formatValue(criterion: PlusMinusCriterion, value: number): string {
    switch (criterion) {
      case 'HEIGHT':
        return `${value.toFixed(1)} m`;
      case 'WEIGHT':
        return `${value.toFixed(1)} kg`;
      case 'AGE':
        return `No ${value}`;
      default:
        return String(value);
    }
  }

  /** Generateur pseudo-aleatoire deterministe (meme partie pour tous un jour donne). */
  private makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private dailySeed(): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return seed || 1;
  }

  private buildDuels(pool: PoolPokemon[], rng: () => number): Duel[] {
    const duels: Duel[] = [];
    for (let round = 0; round < this.TOTAL_ROUNDS; round++) {
      const criterion = CRITERIA[Math.floor(rng() * CRITERIA.length)] ?? 'HP';
      const eligible = pool.filter((p) => this.value(criterion, p) !== null);
      if (eligible.length < 2) continue;

      let a = eligible[Math.floor(rng() * eligible.length)];
      let b = eligible[Math.floor(rng() * eligible.length)];
      let tries = 0;
      while (
        (!a || !b || a.id === b.id || this.value(criterion, a) === this.value(criterion, b)) &&
        tries < 60
      ) {
        a = eligible[Math.floor(rng() * eligible.length)];
        b = eligible[Math.floor(rng() * eligible.length)];
        tries += 1;
      }
      if (!a || !b) continue;

      const va = this.value(criterion, a) ?? 0;
      const vb = this.value(criterion, b) ?? 0;
      const aWins = this.higherWins(criterion) ? va > vb : va < vb;
      duels.push({
        criterion,
        a: { id: a.id, name: a.name, value: va },
        b: { id: b.id, name: b.name, value: vb },
        correct: aWins ? 'A' : 'B',
      });
    }
    return duels;
  }

  private contestant(side: DuelSide): PlusMinusContestant {
    return { pokemonId: side.id, name: side.name, spriteUrl: `/api/pokemon/${side.id}/sprite` };
  }

  private toState(session: PlusMinusSession): PlusMinusRoundState {
    const total = session.duels.length;
    const idx = session.status === 'FINISHED' ? total - 1 : session.currentIndex;
    const duel = session.duels[idx];
    if (!duel) {
      throw new NotFoundException('Manche introuvable');
    }
    return {
      roundId: session.roundId,
      totalRounds: total,
      roundIndex: Math.min(session.currentIndex + 1, total),
      correctCount: session.correctCount,
      status: session.status,
      criterion: duel.criterion,
      criterionLabel: this.criterionLabel(duel.criterion),
      a: this.contestant(duel.a),
      b: this.contestant(duel.b),
    };
  }

  async startDaily(userId?: string): Promise<PlusMinusRoundState> {
    const pool = await this.loadPool();
    if (pool.length < 2) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const duels = this.buildDuels(pool, this.makeRng(this.dailySeed()));
    if (duels.length === 0) {
      throw new NotFoundException('Impossible de générer les duels du jour');
    }

    const roundId = uuidv4();
    const session: PlusMinusSession = {
      roundId,
      duels,
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : {}),
    };
    await this.redisService.set(
      `${this.REDIS_PREFIX}${roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );
    return this.toState(session);
  }

  async getRoundState(roundId: string): Promise<PlusMinusRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return this.toState(JSON.parse(raw) as PlusMinusSession);
  }

  private reveal(duel: Duel, side: DuelSide): PlusMinusReveal {
    return {
      pokemonId: side.id,
      value: side.value,
      displayValue: this.formatValue(duel.criterion, side.value),
    };
  }

  async submitChoice(
    roundId: string,
    choice: 'A' | 'B',
    userId?: string,
  ): Promise<PlusMinusChoiceResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as PlusMinusSession;
    const playedIndex = Math.min(session.currentIndex, session.duels.length - 1);
    const duel = session.duels[playedIndex];
    if (!duel) {
      throw new NotFoundException('Manche introuvable');
    }

    if (session.status !== 'PLAYING') {
      return {
        correct: false,
        correctChoice: duel.correct,
        revealA: this.reveal(duel, duel.a),
        revealB: this.reveal(duel, duel.b),
        state: this.toState(session),
      };
    }

    const correct = choice === duel.correct;
    if (correct) session.correctCount += 1;
    session.currentIndex += 1;
    if (session.currentIndex >= session.duels.length) {
      session.status = 'FINISHED';
    }
    if (userId && !session.userId) {
      session.userId = userId;
    }

    await this.redisService.set(
      `${this.REDIS_PREFIX}${roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );

    if (session.status === 'FINISHED') {
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'PLUS_MINUS',
          duel.a.id,
          duel.a.name,
          session.correctCount === session.duels.length,
          durationSeconds,
          0,
          session.correctCount,
          choice,
          session.userId,
          false,
        ),
      );
    }

    return {
      correct,
      correctChoice: duel.correct,
      revealA: this.reveal(duel, duel.a),
      revealB: this.reveal(duel, duel.b),
      state: this.toState(session),
    };
  }
}
