import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PokemonService } from '../pokemon/pokemon.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import type {
  ShinyChoiceResponse,
  ShinyMode,
  ShinyRoundState,
  ShinyTileReveal,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  name: string;
}

interface SlotDef {
  pokemonId: number;
  name: string;
  shiny: boolean;
}

interface RoundDef {
  slots: SlotDef[]; // 3 Pokemon differents, ordre melange
  answerSlot: number; // vignette a trouver
}

interface ShinySession {
  roundId: string;
  mode: ShinyMode;
  rounds: RoundDef[];
  currentIndex: number;
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  startTime: number;
  userId?: string;
}

const TILES_PER_ROUND = 3;

@Injectable()
export class ShinyService {
  private readonly REDIS_PREFIX = 'game_shiny:';
  private readonly ROUND_TTL_SECONDS = 3600;
  private readonly TOTAL_ROUNDS = 10;

  private poolCache: PoolPokemon[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly pokemonService: PokemonService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async loadPool(): Promise<PoolPokemon[]> {
    if (this.poolCache) return this.poolCache;
    // Seuls les Pokemon dotes d'un sprite shiny sont eligibles (jamais un sprite normal montre comme shiny).
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

  private dailySeed(mode: ShinyMode): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = mode === 'FIND_SHINY' ? 17 : 43;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return seed || 1;
  }

  private prompt(mode: ShinyMode): string {
    return mode === 'FIND_SHINY' ? 'Trouve le shiny' : 'Trouve celui qui n’est pas shiny';
  }

  private pickDistinct(pool: PoolPokemon[], count: number, rng: () => number): PoolPokemon[] {
    const copy = [...pool];
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

  private buildRounds(pool: PoolPokemon[], mode: ShinyMode, rng: () => number): RoundDef[] {
    const rounds: RoundDef[] = [];
    for (let i = 0; i < this.TOTAL_ROUNDS; i++) {
      const trio = this.pickDistinct(pool, TILES_PER_ROUND, rng);
      if (trio.length < TILES_PER_ROUND) continue;
      // FIND_SHINY : une seule vignette shiny (la reponse). FIND_NON_SHINY : une seule normale (la reponse).
      const answerShiny = mode === 'FIND_SHINY';
      const slots: SlotDef[] = trio.map((p, index) => ({
        pokemonId: p.id,
        name: p.name,
        shiny: index === 0 ? answerShiny : !answerShiny,
      }));
      const shuffled = this.shuffle(slots, rng);
      const answerSlot = shuffled.findIndex((s) => s.shiny === answerShiny);
      rounds.push({ slots: shuffled, answerSlot });
    }
    return rounds;
  }

  private toState(session: ShinySession): ShinyRoundState {
    const total = session.rounds.length;
    const idx = session.status === 'FINISHED' ? total - 1 : session.currentIndex;
    const round = session.rounds[idx];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }
    return {
      roundId: session.roundId,
      mode: session.mode,
      totalRounds: total,
      roundIndex: Math.min(session.currentIndex + 1, total),
      correctCount: session.correctCount,
      status: session.status,
      prompt: this.prompt(session.mode),
      tiles: round.slots.map((_, slot) => ({
        slot,
        imageUrl: `/api/games/shiny/tile/${session.roundId}/${idx}/${slot}`,
      })),
    };
  }

  async startDaily(mode: ShinyMode, userId?: string): Promise<ShinyRoundState> {
    const pool = await this.loadPool();
    if (pool.length < TILES_PER_ROUND) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }
    const rounds = this.buildRounds(pool, mode, this.makeRng(this.dailySeed(mode)));
    if (rounds.length === 0) {
      throw new NotFoundException('Impossible de générer les manches du jour');
    }

    const roundId = uuidv4();
    const session: ShinySession = {
      roundId,
      mode,
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

  async getRoundState(roundId: string): Promise<ShinyRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    return this.toState(JSON.parse(raw) as ShinySession);
  }

  /**
   * Sert la vignette d'un slot par un proxy opaque : le mode et la nature shiny ne sont jamais
   * exposes dans l'URL. Les 3 Pokemon etant des especes differentes, meme la taille des octets
   * ne trahit pas la reponse.
   */
  async getTile(
    roundId: string,
    roundIndex: number,
    slot: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as ShinySession;
    const round = session.rounds[roundIndex];
    const slotDef = round?.slots[slot];
    if (!slotDef) {
      throw new NotFoundException('Vignette introuvable');
    }
    return slotDef.shiny
      ? this.pokemonService.getShinySprite(slotDef.pokemonId)
      : this.pokemonService.getSprite(slotDef.pokemonId);
  }

  private reveals(round: RoundDef): ShinyTileReveal[] {
    return round.slots.map((s, slot) => ({
      slot,
      pokemonId: s.pokemonId,
      name: s.name,
      isShiny: s.shiny,
      isAnswer: slot === round.answerSlot,
    }));
  }

  async submitChoice(
    roundId: string,
    slot: number,
    userId?: string,
  ): Promise<ShinyChoiceResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as ShinySession;
    const playedIndex = Math.min(session.currentIndex, session.rounds.length - 1);
    const round = session.rounds[playedIndex];
    if (!round) {
      throw new NotFoundException('Manche introuvable');
    }

    if (session.status !== 'PLAYING') {
      return {
        correct: false,
        answerSlot: round.answerSlot,
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
      const answerTile = round.slots[round.answerSlot];
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'SHINY',
          answerTile?.pokemonId ?? 0,
          answerTile?.name ?? '',
          session.correctCount === session.rounds.length,
          durationSeconds,
          0,
          session.correctCount,
          String(slot),
          session.userId,
          false,
        ),
      );
    }

    return {
      correct,
      answerSlot: round.answerSlot,
      reveals: this.reveals(round),
      state: this.toState(session),
    };
  }
}
