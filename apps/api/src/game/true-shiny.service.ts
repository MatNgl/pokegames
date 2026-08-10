import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PokemonService } from '../pokemon/pokemon.service';
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
  TrueShinyChoiceResponse,
  TrueShinyLevel,
  TrueShinyRoundState,
  TrueShinyTileReveal,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  name: string;
}

interface SlotDef {
  hue: number; // 0 = sprite intact (la reponse), sinon rotation de teinte du leurre
}

interface RoundDef {
  pokemonId: number;
  name: string;
  slots: SlotDef[];
  answerSlot: number;
}

interface TrueShinySession {
  roundId: string;
  level: TrueShinyLevel;
  rounds: RoundDef[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
  guestId?: string;
  guestName?: string;
}

const TRUE_SHINY_LEVELS: TrueShinyLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE'];

// Palette de 10 filtres distincts (rotations de teinte en degres), d'amplitudes variees : des
// subtils (proches de l'intacte, donc durs a distinguer) aux francs. On en tire gridSize-1 par
// manche, sans repetition, pour que les leurres ne se ressemblent jamais et que l'intacte ne
// saute pas aux yeux (notamment quand il y a 6 cartes).
const TRUE_SHINY_HUE_FILTERS = [15, -22, 30, -45, 60, -80, 105, -135, 160, -175];

@Injectable()
export class TrueShinyService {
  private readonly REDIS_PREFIX = 'game_trueshiny:';
  private readonly ROUND_TTL_SECONDS = 3600;

  private poolCache: PoolPokemon[] | null = null;
  private planCache: { date: string; plan: Record<TrueShinyLevel, RoundDef[]> } | null = null;
  private readonly HISTORY_GAME = 'TRUE_SHINY';
  // Cache des vignettes deja traitees (octets), evite de relancer sharp a chaque requete.
  private readonly tileCache = new Map<string, Buffer>();
  private readonly TILE_CACHE_MAX = 800;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly pokemonService: PokemonService,
    private readonly eventEmitter: EventEmitter2,
    private readonly history: HistoryService,
    private readonly dailyResult: DailyResultService,
    private readonly gameConfig: GameConfigService,
  ) {}

  private async loadPool(): Promise<PoolPokemon[]> {
    if (this.poolCache) return this.poolCache;
    const rows = await this.prisma.pokemon.findMany({
      where: { spriteShiny: { not: null } },
      select: { id: true, nameFr: true },
      orderBy: { id: 'asc' },
    });
    this.poolCache = rows.map((row) => ({ id: row.id, name: row.nameFr }));
    return this.poolCache;
  }

  private makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private dailySeed(level: TrueShinyLevel): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 23 + TRUE_SHINY_LEVELS.indexOf(level) * 7;
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

  private buildRounds(
    pool: PoolPokemon[],
    level: TrueShinyLevel,
    rng: () => number,
    used: Set<number>,
  ): RoundDef[] {
    const { roundsCount, levels } = this.gameConfig.trueShiny();
    const { gridSize } = levels[level];
    const available = pool.filter((p) => !used.has(p.id));
    const pokemons = this.shuffle(available, rng).slice(0, roundsCount);
    for (const p of pokemons) used.add(p.id);
    const rounds: RoundDef[] = [];
    for (const p of pokemons) {
      const answerSlot = Math.floor(rng() * gridSize);
      // Filtres distincts pour les leurres : jamais deux fois le meme dans la manche.
      const decoyFilters = this.shuffle([...TRUE_SHINY_HUE_FILTERS], rng).slice(0, gridSize - 1);
      const slots: SlotDef[] = [];
      let d = 0;
      for (let s = 0; s < gridSize; s++) {
        if (s === answerSlot) {
          slots.push({ hue: 0 });
          continue;
        }
        slots.push({ hue: decoyFilters[d++] ?? 90 });
      }
      rounds.push({ pokemonId: p.id, name: p.name, slots, answerSlot });
    }
    return rounds;
  }

  private buildPlan(
    pool: PoolPokemon[],
    initialUsed: Set<number>,
  ): Record<TrueShinyLevel, RoundDef[]> {
    const rng = this.makeRng(this.dailySeed('FACILE'));
    const used = new Set<number>(initialUsed);
    const plan = {} as Record<TrueShinyLevel, RoundDef[]>;
    for (const level of TRUE_SHINY_LEVELS) {
      plan[level] = this.buildRounds(pool, level, rng, used);
    }
    return plan;
  }

  private planComplete(plan: Record<TrueShinyLevel, RoundDef[]>): boolean {
    return TRUE_SHINY_LEVELS.every((level) => plan[level].length === this.gameConfig.trueShiny().roundsCount);
  }

  /**
   * Plan du jour : dedup entre niveaux (meme jour) + anti-repetition cross-jours via l'historique.
   * Repli sans historique si un niveau devient incomplet. Tirage enregistre une fois par jour.
   */
  private async getDailyPlan(pool: PoolPokemon[]): Promise<Record<TrueShinyLevel, RoundDef[]>> {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    if (this.planCache && this.planCache.date === today) {
      return this.planCache.plan;
    }
    const now = new Date();
    const recent = await this.history.recentPokemonIds(
      this.HISTORY_GAME,
      '',
      now,
      this.gameConfig.antiRepeatWindow('TRUE_SHINY'),
    );
    let plan = this.buildPlan(pool, recent);
    if (!this.planComplete(plan)) {
      plan = this.buildPlan(pool, new Set<number>());
    }

    if (!(await this.history.hasPicksFor(this.HISTORY_GAME, '', now))) {
      const ids = new Set<number>();
      for (const level of TRUE_SHINY_LEVELS) {
        for (const round of plan[level]) ids.add(round.pokemonId);
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

  private toState(session: TrueShinySession): TrueShinyRoundState {
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
      tiles: round.slots.map((_, slot) => ({
        slot,
        imageUrl: `/api/games/true-shiny/tile/${session.roundId}/${idx}/${slot}`,
      })),
    };
  }

  async startDaily(level: TrueShinyLevel, player: PlayerIdentity = {}): Promise<TrueShinyRoundState> {
    const userId = player.userId;
    if (!TRUE_SHINY_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    if (userId && (await this.dailyResult.hasCompleted(userId, this.HISTORY_GAME, level, new Date()))) {
      throw new ConflictException('DAILY_ALREADY_COMPLETED');
    }
    const pool = await this.loadPool();
    if (pool.length < this.gameConfig.trueShiny().roundsCount) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const rounds = (await this.getDailyPlan(pool))[level];
    if (rounds.length === 0) {
      throw new NotFoundException('Impossible de générer les manches du jour');
    }

    const roundId = uuidv4();
    const session: TrueShinySession = {
      roundId,
      level,
      rounds,
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : guestSessionFields(player)),
    };
    await this.persist(session);
    return this.toState(session);
  }

  async getRoundState(roundId: string): Promise<TrueShinyRoundState> {
    return this.toState(await this.load(roundId));
  }

  private async load(roundId: string): Promise<TrueShinySession> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return JSON.parse(raw) as TrueShinySession;
  }

  private async persist(session: TrueShinySession): Promise<void> {
    await this.redisService.set(
      `${this.REDIS_PREFIX}${session.roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );
  }

  /**
   * Sert une vignette deja traitee cote serveur (Regle 2 : jamais de filtre CSS client qui
   * revelerait la carte intacte a l'inspection). L'URL n'expose ni le Pokemon ni la teinte.
   */
  async getTile(
    roundId: string,
    roundIndex: number,
    slot: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const session = await this.load(roundId);
    const round = session.rounds[roundIndex];
    const slotDef = round?.slots[slot];
    if (!round || !slotDef) {
      throw new NotFoundException('Vignette introuvable');
    }

    const cacheKey = `${round.pokemonId}:${slotDef.hue}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached) {
      return { buffer: cached, contentType: 'image/png' };
    }

    const original = await this.pokemonService.getShinySprite(round.pokemonId);
    // Toutes les vignettes (intacte comprise) passent par le meme encodeur sharp : ainsi la
    // vignette intacte n'est pas un outlier d'encodage repérable a la taille des octets.
    // La vignette intacte passe par exactement le meme traitement que les leurres (modulate avec une
    // rotation nulle, et non un court-circuit) : sans cela elle evite l'aller-retour colorimetrique
    // de libvips, et son encodage se distingue de celui des autres.
    const buffer = await sharp(original.buffer)
      .modulate({ hue: slotDef.hue })
      .png()
      .toBuffer();

    this.tileCache.set(cacheKey, buffer);
    if (this.tileCache.size > this.TILE_CACHE_MAX) {
      const oldest = this.tileCache.keys().next().value;
      if (oldest !== undefined) this.tileCache.delete(oldest);
    }
    return { buffer, contentType: 'image/png' };
  }

  private reveals(round: RoundDef): TrueShinyTileReveal[] {
    return round.slots.map((_, slot) => ({ slot, isAnswer: slot === round.answerSlot }));
  }

  async submitChoice(
    roundId: string,
    slot: number,
    userId?: string,
  ): Promise<TrueShinyChoiceResponse> {
    const session = await this.load(roundId);
    if (userId && !session.userId) session.userId = userId;
    const playedIndex = Math.min(session.currentIndex, session.rounds.length - 1);
    const round = session.rounds[playedIndex];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }

    if (session.status !== 'PLAYING') {
      return {
        correct: false,
        answerSlot: round.answerSlot,
        pokemonName: round.name,
        reveals: this.reveals(round),
        state: this.toState(session),
      };
    }

    if (slot < 0 || slot >= round.slots.length) {
      throw new NotFoundException('Vignette hors de cette manche');
    }

    const correct = slot === round.answerSlot;
    if (correct) session.correctCount += 1;
    session.currentIndex += 1;
    if (session.currentIndex >= session.rounds.length) {
      session.status = 'FINISHED';
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      const won = session.correctCount === session.rounds.length;
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'TRUE_SHINY',
          round.pokemonId,
          round.name,
          won,
          durationSeconds,
          0,
          session.correctCount,
          String(slot),
          session.userId,
          false,
        ),
      );
      const player = playerFromSession(session);
      if (player.userId || player.guestId) {
        await this.dailyResult.record(player, this.HISTORY_GAME, session.level, new Date(), {
          won,
          correctCount: session.correctCount,
          totalRounds: session.rounds.length,
          durationSeconds,
        });
      }
    }

    await this.persist(session);

    return {
      correct,
      answerSlot: round.answerSlot,
      pokemonName: round.name,
      reveals: this.reveals(round),
      state: this.toState(session),
    };
  }
}
