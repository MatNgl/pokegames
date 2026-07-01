import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import { INTRUDER_CONFIG, type IntruderHintMode } from './game-config';
import type {
  IntruderChoiceResponse,
  IntruderLevel,
  IntruderMember,
  IntruderMemberReveal,
  IntruderRoundState,
  IntruderRule,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  pokedexId: number;
  name: string;
  generation: number;
  primaryTypeName: string | null;
  primaryTypeImage: string | null;
  hp: number;
  atk: number;
  def: number;
  speAtk: number;
  speDef: number;
  speed: number;
  isFinalEvolution: boolean;
  hasMega: boolean;
}

interface StoredReveal {
  pokemonId: number;
  name: string;
  isIntruder: boolean;
  detail: string;
  typeImage?: string;
  megaSpriteUrl?: string;
}

interface RoundDef {
  rule: IntruderRule;
  memberIds: number[]; // gridSize Pokemon melanges
  names: Record<number, string>;
  intruderId: number;
  commonLabel: string;
  hint: string | null; // indice pre-reponse (selon le niveau)
  reveals: StoredReveal[];
}

interface IntruderSession {
  roundId: string;
  level: IntruderLevel;
  rounds: RoundDef[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
}

interface StatDescriptor {
  key: 'hp' | 'atk' | 'def' | 'speAtk' | 'speDef' | 'speed';
  label: string;
}

const STAT_DESCRIPTORS: StatDescriptor[] = [
  { key: 'hp', label: 'PV' },
  { key: 'atk', label: 'Attaque' },
  { key: 'def', label: 'Défense' },
  { key: 'speAtk', label: 'Attaque Spéciale' },
  { key: 'speDef', label: 'Défense Spéciale' },
  { key: 'speed', label: 'Vitesse' },
];

const STAT_THRESHOLDS = [50, 60, 70, 80, 90, 100, 110, 120];

const INTRUDER_LEVELS: IntruderLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE'];

interface HintExtra {
  gen?: number;
  typeName?: string;
  statLabel?: string;
}

@Injectable()
export class IntruderService {
  private readonly REDIS_PREFIX = 'game_intruder:';
  private readonly ROUND_TTL_SECONDS = 3600;
  private readonly PROMPT = 'Trouve l’intrus';

  private poolCache: PoolPokemon[] | null = null;
  // Plan du jour (tous niveaux) memoise : determinisme + dedup inter-niveaux.
  private planCache: { date: string; plan: Record<IntruderLevel, RoundDef[]> } | null = null;

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
        generation: true,
        statsHp: true,
        statsAtk: true,
        statsDef: true,
        statsSpeAtk: true,
        statsSpeDef: true,
        statsSpeed: true,
        isFinalEvolution: true,
        hasMega: true,
        types: { select: { slot: true, type: { select: { nameFr: true, image: true } } } },
      },
      orderBy: { id: 'asc' },
    });
    this.poolCache = rows.map((row) => {
      const primary = row.types.find((t) => t.slot === 1) ?? row.types[0];
      return {
        id: row.id,
        pokedexId: row.pokedexId,
        name: row.nameFr,
        generation: row.generation,
        primaryTypeName: primary?.type.nameFr ?? null,
        primaryTypeImage: primary?.type.image ?? null,
        hp: row.statsHp,
        atk: row.statsAtk,
        def: row.statsDef,
        speAtk: row.statsSpeAtk,
        speDef: row.statsSpeDef,
        speed: row.statsSpeed,
        isFinalEvolution: row.isFinalEvolution,
        hasMega: row.hasMega,
      };
    });
    return this.poolCache;
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

  private statValue(p: PoolPokemon, key: StatDescriptor['key']): number {
    return p[key];
  }

  private pickDistinct(source: PoolPokemon[], count: number, rng: () => number): PoolPokemon[] {
    const copy = [...source];
    const picked: PoolPokemon[] = [];
    while (picked.length < count && copy.length > 0) {
      const idx = Math.floor(rng() * copy.length);
      const [item] = copy.splice(idx, 1);
      if (item) picked.push(item);
    }
    return picked;
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

  /** Indice pre-reponse selon le niveau. N'indique jamais quel Pokemon est l'intrus. */
  private hintFor(hintMode: IntruderHintMode, rule: IntruderRule, extra: HintExtra): string | null {
    if (hintMode === 'EXPLICIT') {
      switch (rule) {
        case 'GENERATION':
          return `Trouve celui qui n'est pas de la génération ${extra.gen}`;
        case 'TYPE':
          return `Trouve celui qui n'est pas de type ${extra.typeName}`;
        case 'EVOLUTION':
          return "Trouve celui dont le stade d'évolution diffère";
        case 'MEGA':
          return 'Trouve celui qui ne peut pas méga-évoluer';
        case 'STAT':
          return extra.statLabel ? `Regarde du côté de la ${extra.statLabel}` : null;
        default:
          return null;
      }
    }
    if (hintMode === 'DOMAIN') {
      switch (rule) {
        case 'STAT':
          return extra.statLabel ? `Indice : regarde du côté de la ${extra.statLabel}` : null;
        case 'EVOLUTION':
          return "Indice : regarde les stades d'évolution";
        case 'GENERATION':
          return 'Indice : compare les générations';
        case 'TYPE':
          return 'Indice : compare les types';
        case 'MEGA':
          return 'Indice : pense aux méga-évolutions';
        default:
          return null;
      }
    }
    // STAT_ONLY : indice fourni uniquement si le critere est une stat.
    return rule === 'STAT' && extra.statLabel ? `Indice : regarde du côté de la ${extra.statLabel}` : null;
  }

  private assemble(
    rule: IntruderRule,
    matching: PoolPokemon[],
    intruder: PoolPokemon,
    commonLabel: string,
    hint: string | null,
    detailOf: (p: PoolPokemon) => Omit<StoredReveal, 'pokemonId' | 'name' | 'isIntruder'>,
    rng: () => number,
  ): RoundDef {
    const all = [...matching, intruder];
    const shuffled = this.shuffle(all, rng);
    const names: Record<number, string> = {};
    const reveals: StoredReveal[] = shuffled.map((p) => {
      names[p.id] = p.name;
      return {
        pokemonId: p.id,
        name: p.name,
        isIntruder: p.id === intruder.id,
        ...detailOf(p),
      };
    });
    return {
      rule,
      memberIds: shuffled.map((p) => p.id),
      names,
      intruderId: intruder.id,
      commonLabel,
      hint,
      reveals,
    };
  }

  private buildGeneration(
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    const byGen = new Map<number, PoolPokemon[]>();
    for (const p of pool) {
      const list = byGen.get(p.generation) ?? [];
      list.push(p);
      byGen.set(p.generation, list);
    }
    const eligible = [...byGen.entries()].filter(([, list]) => list.length >= matchCount);
    const picked = eligible[Math.floor(rng() * eligible.length)];
    if (!picked) return null;
    const [gen, group] = picked;
    const others = pool.filter((p) => p.generation !== gen);
    if (others.length === 0) return null;
    const matching = this.pickDistinct(group, matchCount, rng);
    if (matching.length < matchCount) return null;
    const intruder = this.pickDistinct(others, 1, rng)[0];
    if (!intruder) return null;
    return this.assemble(
      'GENERATION',
      matching,
      intruder,
      `Même génération : Génération ${gen}`,
      this.hintFor(hintMode, 'GENERATION', { gen }),
      (p) => ({ detail: `Génération ${p.generation}` }),
      rng,
    );
  }

  private buildType(
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    const typed = pool.filter((p) => p.primaryTypeName !== null);
    const byType = new Map<string, PoolPokemon[]>();
    for (const p of typed) {
      const key = p.primaryTypeName as string;
      const list = byType.get(key) ?? [];
      list.push(p);
      byType.set(key, list);
    }
    const eligible = [...byType.entries()].filter(([, list]) => list.length >= matchCount);
    const picked = eligible[Math.floor(rng() * eligible.length)];
    if (!picked) return null;
    const [typeName, group] = picked;
    const others = typed.filter((p) => p.primaryTypeName !== typeName);
    if (others.length === 0) return null;
    const matching = this.pickDistinct(group, matchCount, rng);
    if (matching.length < matchCount) return null;
    const intruder = this.pickDistinct(others, 1, rng)[0];
    if (!intruder) return null;
    return this.assemble(
      'TYPE',
      matching,
      intruder,
      `Même type principal : ${typeName}`,
      this.hintFor(hintMode, 'TYPE', { typeName }),
      (p) => ({
        detail: p.primaryTypeName ?? 'Type inconnu',
        ...(p.primaryTypeImage ? { typeImage: p.primaryTypeImage } : {}),
      }),
      rng,
    );
  }

  private buildStat(
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    for (let attempt = 0; attempt < 40; attempt++) {
      const descriptor = STAT_DESCRIPTORS[Math.floor(rng() * STAT_DESCRIPTORS.length)];
      const threshold = STAT_THRESHOLDS[Math.floor(rng() * STAT_THRESHOLDS.length)];
      if (!descriptor || threshold === undefined) continue;
      const below = pool.filter((p) => this.statValue(p, descriptor.key) < threshold);
      const atOrAbove = pool.filter((p) => this.statValue(p, descriptor.key) >= threshold);
      const majorityBelow = below.length >= matchCount && atOrAbove.length >= 1;
      const majorityAbove = atOrAbove.length >= matchCount && below.length >= 1;
      if (!majorityBelow && !majorityAbove) continue;
      const useBelow = majorityBelow && (!majorityAbove || rng() < 0.5);
      const group = useBelow ? below : atOrAbove;
      const others = useBelow ? atOrAbove : below;
      const matching = this.pickDistinct(group, matchCount, rng);
      if (matching.length < matchCount) continue;
      const intruder = this.pickDistinct(others, 1, rng)[0];
      if (!intruder) continue;
      const commonLabel = useBelow
        ? `Moins de ${threshold} en ${descriptor.label}`
        : `Au moins ${threshold} en ${descriptor.label}`;
      return this.assemble(
        'STAT',
        matching,
        intruder,
        commonLabel,
        this.hintFor(hintMode, 'STAT', { statLabel: descriptor.label }),
        (p) => ({ detail: `${descriptor.label} : ${this.statValue(p, descriptor.key)}` }),
        rng,
      );
    }
    return null;
  }

  private buildEvolution(
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    const finals = pool.filter((p) => p.isFinalEvolution);
    const nonFinals = pool.filter((p) => !p.isFinalEvolution);
    const canFinalMajority = finals.length >= matchCount && nonFinals.length >= 1;
    const canNonFinalMajority = nonFinals.length >= matchCount && finals.length >= 1;
    if (!canFinalMajority && !canNonFinalMajority) return null;
    const useFinal = canFinalMajority && (!canNonFinalMajority || rng() < 0.5);
    const group = useFinal ? finals : nonFinals;
    const others = useFinal ? nonFinals : finals;
    const matching = this.pickDistinct(group, matchCount, rng);
    if (matching.length < matchCount) return null;
    const intruder = this.pickDistinct(others, 1, rng)[0];
    if (!intruder) return null;
    const commonLabel = useFinal
      ? 'Trois formes finales, un intrus qui peut encore évoluer'
      : 'Trois Pokémon qui peuvent encore évoluer, un intrus déjà au maximum';
    return this.assemble(
      'EVOLUTION',
      matching,
      intruder,
      commonLabel,
      this.hintFor(hintMode, 'EVOLUTION', {}),
      (p) => ({ detail: p.isFinalEvolution ? 'Forme finale' : 'Peut encore évoluer' }),
      rng,
    );
  }

  private buildMega(
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    const withMega = pool.filter((p) => p.hasMega);
    const withoutMega = pool.filter((p) => !p.hasMega);
    if (withMega.length < matchCount || withoutMega.length < 1) return null;
    const matching = this.pickDistinct(withMega, matchCount, rng);
    if (matching.length < matchCount) return null;
    const intruder = this.pickDistinct(withoutMega, 1, rng)[0];
    if (!intruder) return null;
    return this.assemble(
      'MEGA',
      matching,
      intruder,
      'Trois Pokémon capables de méga-évoluer, un intrus qui ne le peut pas',
      this.hintFor(hintMode, 'MEGA', {}),
      (p) => ({
        detail: p.hasMega ? 'Méga-évolution' : 'Aucune méga-évolution',
        ...(p.hasMega ? { megaSpriteUrl: `/api/pokemon/${p.id}/mega-sprite` } : {}),
      }),
      rng,
    );
  }

  private buildRoundForRule(
    rule: IntruderRule,
    pool: PoolPokemon[],
    matchCount: number,
    hintMode: IntruderHintMode,
    rng: () => number,
  ): RoundDef | null {
    switch (rule) {
      case 'GENERATION':
        return this.buildGeneration(pool, matchCount, hintMode, rng);
      case 'TYPE':
        return this.buildType(pool, matchCount, hintMode, rng);
      case 'STAT':
        return this.buildStat(pool, matchCount, hintMode, rng);
      case 'EVOLUTION':
        return this.buildEvolution(pool, matchCount, hintMode, rng);
      case 'MEGA':
        return this.buildMega(pool, matchCount, hintMode, rng);
      default:
        return null;
    }
  }

  private buildRounds(
    pool: PoolPokemon[],
    level: IntruderLevel,
    rng: () => number,
    used: Set<number>,
  ): RoundDef[] {
    const { gridSize, rules, hintMode } = INTRUDER_CONFIG.levels[level];
    const matchCount = gridSize - 1;
    const rounds: RoundDef[] = [];
    for (let i = 0; i < INTRUDER_CONFIG.roundsCount; i++) {
      // Exclut les Pokemon deja pris (dedup intra-session et entre niveaux du jour).
      const avail = pool.filter((p) => !used.has(p.id));
      const order = this.shuffle(rules, rng);
      let round: RoundDef | null = null;
      for (const rule of order) {
        round = this.buildRoundForRule(rule, avail, matchCount, hintMode, rng);
        if (round) break;
      }
      if (round) {
        rounds.push(round);
        for (const id of round.memberIds) used.add(id);
      }
    }
    return rounds;
  }

  /**
   * Plan du jour complet : les 3 niveaux construits dans un ordre fixe avec un meme RNG et un
   * ensemble d'exclusion partage, pour qu'aucun Pokemon ne se repete entre les niveaux du jour.
   */
  private getDailyPlan(pool: PoolPokemon[]): Record<IntruderLevel, RoundDef[]> {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    if (this.planCache && this.planCache.date === today) {
      return this.planCache.plan;
    }
    const rng = this.makeRng(this.dailySeed());
    const used = new Set<number>();
    const plan = {} as Record<IntruderLevel, RoundDef[]>;
    for (const level of INTRUDER_LEVELS) {
      plan[level] = this.buildRounds(pool, level, rng, used);
    }
    this.planCache = { date: today, plan };
    return plan;
  }

  private member(id: number, name: string): IntruderMember {
    return { pokemonId: id, name, spriteUrl: `/api/pokemon/${id}/sprite` };
  }

  private toState(session: IntruderSession): IntruderRoundState {
    const total = session.rounds.length;
    const idx = session.status === 'FINISHED' ? total - 1 : session.currentIndex;
    const round = session.rounds[idx];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }
    return {
      roundId: session.roundId,
      level: session.level,
      totalRounds: total,
      roundIndex: Math.min(session.currentIndex + 1, total),
      correctCount: session.correctCount,
      status: session.status,
      prompt: this.PROMPT,
      hint: round.hint,
      members: round.memberIds.map((id) => this.member(id, round.names[id] ?? '')),
    };
  }

  async startDaily(level: IntruderLevel, userId?: string): Promise<IntruderRoundState> {
    if (!INTRUDER_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    const pool = await this.loadPool();
    if (pool.length < INTRUDER_CONFIG.levels[level].gridSize) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const rounds = this.getDailyPlan(pool)[level];
    if (rounds.length === 0) {
      throw new NotFoundException('Impossible de générer les manches du jour');
    }

    const roundId = uuidv4();
    const session: IntruderSession = {
      roundId,
      level,
      rounds,
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

  async getRoundState(roundId: string): Promise<IntruderRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return this.toState(JSON.parse(raw) as IntruderSession);
  }

  private publicReveals(round: RoundDef): IntruderMemberReveal[] {
    return round.reveals.map((r) => ({
      pokemonId: r.pokemonId,
      isIntruder: r.isIntruder,
      detail: r.detail,
      ...(r.typeImage ? { typeImage: r.typeImage } : {}),
      ...(r.megaSpriteUrl ? { megaSpriteUrl: r.megaSpriteUrl } : {}),
    }));
  }

  async submitChoice(
    roundId: string,
    pokemonId: number,
    userId?: string,
  ): Promise<IntruderChoiceResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as IntruderSession;
    const playedIndex = Math.min(session.currentIndex, session.rounds.length - 1);
    const round = session.rounds[playedIndex];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }

    if (session.status !== 'PLAYING') {
      return {
        correct: false,
        intruderId: round.intruderId,
        rule: round.rule,
        commonLabel: round.commonLabel,
        reveals: this.publicReveals(round),
        state: this.toState(session),
      };
    }

    if (!round.memberIds.includes(pokemonId)) {
      throw new NotFoundException('Pokémon hors de cette manche');
    }

    const correct = pokemonId === round.intruderId;
    if (correct) session.correctCount += 1;
    session.currentIndex += 1;
    if (session.currentIndex >= session.rounds.length) {
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
          'INTRUDER',
          round.intruderId,
          round.names[round.intruderId] ?? '',
          session.correctCount === session.rounds.length,
          durationSeconds,
          0,
          session.correctCount,
          String(pokemonId),
          session.userId,
          false,
        ),
      );
    }

    return {
      correct,
      intruderId: round.intruderId,
      rule: round.rule,
      commonLabel: round.commonLabel,
      reveals: this.publicReveals(round),
      state: this.toState(session),
    };
  }
}
