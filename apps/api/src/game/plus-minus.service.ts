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
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import type {
  PlusMinusChoiceResponse,
  PlusMinusContestant,
  PlusMinusCriterion,
  PlusMinusLevel,
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
  // true : la plus grande valeur gagne ; false : la plus petite. Pour l'anciennete (numero de
  // Pokedex), le sens est tire au hasard par duel et enonce clairement dans la question.
  wantHigher: boolean;
}

interface PlusMinusSession {
  roundId: string;
  level: PlusMinusLevel;
  duels: Duel[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
}

// Ensemble complet des criteres. La config restreint lesquels sont actifs (enabledStats).
const ALL_CRITERIA: PlusMinusCriterion[] = ['HP', 'HEIGHT', 'WEIGHT', 'ATK', 'DEF', 'SPEED', 'AGE'];

// Ordre fixe de construction du plan du jour. La dedup entre niveaux depend de cet ordre :
// chaque niveau tire en excluant les Pokemon deja pris par les niveaux precedents.
const PLUS_MINUS_LEVELS: PlusMinusLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE', 'EXTREME'];

@Injectable()
export class PlusMinusService {
  private readonly REDIS_PREFIX = 'game_plusminus:';
  private readonly ROUND_TTL_SECONDS = 3600;

  private poolCache: PoolPokemon[] | null = null;
  // Plan du jour (tous niveaux) memoise : garantit le determinisme et la dedup inter-niveaux.
  private planCache: { date: string; plan: Record<PlusMinusLevel, Duel[]> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly history: HistoryService,
    private readonly dailyResult: DailyResultService,
    private readonly gameConfig: GameConfigService,
  ) {}

  private readonly HISTORY_GAME = 'PLUS_MINUS';

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

  private criterionLabel(criterion: PlusMinusCriterion, wantHigher: boolean): string {
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
        return wantHigher
          ? 'Lequel a le plus grand numéro de Pokédex ?'
          : 'Lequel a le plus petit numéro de Pokédex ?';
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

  // Ramene l'ecart brut d'une dimension a des "points" comparables aux seuils de niveau.
  // La taille est en metres : on la ramene en centimetres (x100). Le reste est deja en points.
  private dimensionScale(criterion: PlusMinusCriterion): number {
    return criterion === 'HEIGHT' ? 100 : 1;
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

  /**
   * Construit un duel respectant la bande d'ecart du niveau, en excluant les Pokemon deja
   * utilises (dedup intra-session et entre niveaux du meme jour). Renvoie null si aucun couple
   * ne convient pour ce niveau.
   */
  private buildDuelForLevel(
    pool: PoolPokemon[],
    level: PlusMinusLevel,
    rng: () => number,
    used: Set<number>,
  ): Duel | null {
    const { minDiff, maxDiff, ageMinDiff } = this.gameConfig.plusMinus().levels[level];
    const enabled = this.gameConfig.plusMinus().enabledStats;
    const criteria = enabled.length > 0 ? ALL_CRITERIA.filter((c) => enabled.includes(c)) : ALL_CRITERIA;
    for (const criterion of this.shuffle(criteria, rng)) {
      // L'anciennete (numero de Pokedex) a sa propre echelle : ecart minimal dedie, sans plafond.
      const isAge = criterion === 'AGE';
      const scale = this.dimensionScale(criterion);
      const minRaw = isAge ? ageMinDiff : minDiff / scale;
      const maxRaw = isAge ? Number.POSITIVE_INFINITY : maxDiff / scale;
      const eligible = pool.filter((p) => this.value(criterion, p) !== null && !used.has(p.id));
      if (eligible.length < 2) continue;

      for (let attempt = 0; attempt < 40; attempt++) {
        const a = eligible[Math.floor(rng() * eligible.length)];
        if (!a) continue;
        const va = this.value(criterion, a);
        if (va === null) continue;
        const candidates = eligible.filter((p) => {
          if (p.id === a.id) return false;
          const vp = this.value(criterion, p);
          if (vp === null) return false;
          const diff = Math.abs(vp - va);
          return diff >= minRaw && diff <= maxRaw;
        });
        const b = candidates[Math.floor(rng() * candidates.length)];
        if (!b) continue;
        const vb = this.value(criterion, b) ?? 0;
        // Anciennete : sens tire au hasard (plus petit ou plus grand numero). Sinon, la plus grande valeur gagne.
        const wantHigher = isAge ? rng() < 0.5 : true;
        const aWins = wantHigher ? va > vb : va < vb;
        used.add(a.id);
        used.add(b.id);
        return {
          criterion,
          a: { id: a.id, name: a.name, value: va },
          b: { id: b.id, name: b.name, value: vb },
          correct: aWins ? 'A' : 'B',
          wantHigher,
        };
      }
    }
    return null;
  }

  private buildDuels(
    pool: PoolPokemon[],
    level: PlusMinusLevel,
    rng: () => number,
    used: Set<number>,
  ): Duel[] {
    const duels: Duel[] = [];
    for (let round = 0; round < this.gameConfig.plusMinus().roundsCount; round++) {
      const duel = this.buildDuelForLevel(pool, level, rng, used);
      if (duel) duels.push(duel);
    }
    return duels;
  }

  // Construit tous les niveaux avec un meme RNG et une exclusion partagee (dedup intra-jour + historique).
  private buildPlan(pool: PoolPokemon[], initialUsed: Set<number>): Record<PlusMinusLevel, Duel[]> {
    const rng = this.makeRng(this.dailySeed());
    const used = new Set<number>(initialUsed);
    const plan = {} as Record<PlusMinusLevel, Duel[]>;
    for (const level of PLUS_MINUS_LEVELS) {
      plan[level] = this.buildDuels(pool, level, rng, used);
    }
    return plan;
  }

  private planComplete(plan: Record<PlusMinusLevel, Duel[]>): boolean {
    return PLUS_MINUS_LEVELS.every((level) => plan[level].length === this.gameConfig.plusMinus().roundsCount);
  }

  /**
   * Plan du jour : dedup entre niveaux (meme jour) + anti-repetition cross-jours via l'historique.
   * On exclut les Pokemon tires ces derniers jours ; si l'exclusion rend un niveau incomplet, on
   * rejoue sans l'historique (repli). Le tirage retenu est enregistre une fois par jour.
   */
  private async getDailyPlan(pool: PoolPokemon[]): Promise<Record<PlusMinusLevel, Duel[]>> {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    if (this.planCache && this.planCache.date === today) {
      return this.planCache.plan;
    }
    const now = new Date();
    const recent = await this.history.recentPokemonIds(
      this.HISTORY_GAME,
      '',
      now,
      this.gameConfig.antiRepeatWindow('PLUS_MINUS'),
    );
    let plan = this.buildPlan(pool, recent);
    if (!this.planComplete(plan)) {
      plan = this.buildPlan(pool, new Set<number>());
    }

    if (!(await this.history.hasPicksFor(this.HISTORY_GAME, '', now))) {
      const ids = new Set<number>();
      for (const level of PLUS_MINUS_LEVELS) {
        for (const duel of plan[level]) {
          ids.add(duel.a.id);
          ids.add(duel.b.id);
        }
      }
      await this.history.recordPicks(
        this.HISTORY_GAME,
        '',
        now,
        [...ids].map((id) => ({ pokemonId: id })),
      );
    }

    this.planCache = { date: today, plan };
    return plan;
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
      level: session.level,
      totalRounds: total,
      roundIndex: Math.min(session.currentIndex + 1, total),
      correctCount: session.correctCount,
      status: session.status,
      criterion: duel.criterion,
      criterionLabel: this.criterionLabel(duel.criterion, duel.wantHigher === true),
      a: this.contestant(duel.a),
      b: this.contestant(duel.b),
    };
  }

  async startDaily(level: PlusMinusLevel, userId?: string): Promise<PlusMinusRoundState> {
    if (!PLUS_MINUS_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    // Verrou serveur : un joueur connecte ne rejoue pas un defi deja termine aujourd'hui.
    if (userId && (await this.dailyResult.hasCompleted(userId, this.HISTORY_GAME, level, new Date()))) {
      throw new ConflictException('DAILY_ALREADY_COMPLETED');
    }
    const pool = await this.loadPool();
    if (pool.length < 2) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const duels = (await this.getDailyPlan(pool))[level];
    if (duels.length === 0) {
      throw new NotFoundException('Impossible de générer les duels du jour');
    }

    const roundId = uuidv4();
    const session: PlusMinusSession = {
      roundId,
      level,
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
      const won = session.correctCount === session.duels.length;
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'PLUS_MINUS',
          duel.a.id,
          duel.a.name,
          won,
          durationSeconds,
          0,
          session.correctCount,
          choice,
          session.userId,
          false,
        ),
      );
      if (session.userId) {
        await this.dailyResult.record(session.userId, this.HISTORY_GAME, session.level, new Date(), {
          won,
          correctCount: session.correctCount,
          totalRounds: session.duels.length,
          durationSeconds,
        });
      }
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
