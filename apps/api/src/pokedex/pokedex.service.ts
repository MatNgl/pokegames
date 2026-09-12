import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpriteProxyService } from '../game/sprite-proxy.service';
import {
  POKEDEX_CORNERS,
  POKEDEX_ZONES,
  type PokedexCatalogEntry,
  type PokedexCorner,
  type PokedexCollectResponse,
  type PokedexCollectionDTO,
  type PokedexDetailDTO,
  type PokedexRevealedPokemon,
  type PokedexSpawnDTO,
} from '@pokegames/shared-types';

interface PoolPokemon {
  id: number;
  pokedexId: number;
  nameFr: string;
  generation: number;
  spriteRegular: string;
}

/**
 * Easter eggs (silhouettes cachées à collecter) + Pokédex personnel.
 * Autorité serveur : le client ne connaît jamais le Pokémon avant la collecte. Une apparition par
 * zone et par jour (fixe) empêche de rafraîchir une page pour en faire réapparaître de nouvelles.
 */
@Injectable()
export class PokedexService {
  private readonly DAILY_COUNT = 10;
  private readonly SPRITE_TTL_SECONDS = 2 * 3600;
  private readonly EASTER_EGG_SOURCE = 'EASTER_EGG';
  // Jetons invités : signés (pas de persistance), stables pour la journée.
  private readonly GUEST_SECRET = process.env['JWT_SECRET'] ?? 'pokegames-dev-secret-only';
  private catalogCache: PoolPokemon[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly spriteProxy: SpriteProxyService,
  ) {}

  private utcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private dayStr(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async catalog(): Promise<PoolPokemon[]> {
    if (this.catalogCache) return this.catalogCache;
    const rows = await this.prisma.pokemon.findMany({
      select: { id: true, pokedexId: true, nameFr: true, generation: true, spriteRegular: true },
      orderBy: { pokedexId: 'asc' },
    });
    this.catalogCache = rows;
    return rows;
  }

  private makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private hashSeed(str: string): number {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h || 1;
  }

  // Tirage sans remise de `count` éléments (Fisher-Yates partiel, déterministe via rng).
  private pickDistinct<T>(arr: T[], count: number, rng: () => number): T[] {
    const copy = [...arr];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(rng() * (copy.length - i));
      const t = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = t;
    }
    return copy.slice(0, n);
  }

  // ===== Jetons invités signés =====
  private guestToken(pokemonId: number, dayStr: string): string {
    const payload = `${pokemonId}:${dayStr}`;
    const sig = createHmac('sha256', this.GUEST_SECRET).update(payload).digest('hex').slice(0, 16);
    return `g.${Buffer.from(payload).toString('base64url')}.${sig}`;
  }

  private parseGuestToken(token: string): { pokemonId: number } | null {
    if (!token.startsWith('g.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString();
    const expected = createHmac('sha256', this.GUEST_SECRET).update(payload).digest('hex').slice(0, 16);
    if (expected !== parts[2]) return null;
    const pokemonId = Number(payload.split(':')[0]);
    return Number.isInteger(pokemonId) ? { pokemonId } : null;
  }

  private guestSessionHash(token: string): string {
    return createHmac('sha256', this.GUEST_SECRET).update(`sh:${token}`).digest('hex').slice(0, 16);
  }

  // Avalanche 32 bits : hashSeed seul garde des bits de poids faible corrélés entre chaînes
  // voisines, ce qui collerait plusieurs apparitions dans le même coin.
  private mix32(value: number): number {
    let x = value >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  // Coin d'apparition dérivé du jeton : réparti sur les 4 coins, stable tant que le jeton l'est
  // (donc identique après un rafraîchissement, comme la zone et le Pokémon du jour).
  private cornerFor(token: string): PokedexCorner {
    const index = this.mix32(this.hashSeed(`corner:${token}`)) % POKEDEX_CORNERS.length;
    return POKEDEX_CORNERS[index]!;
  }

  private revealed(p: PoolPokemon): PokedexRevealedPokemon {
    return {
      id: p.id,
      pokedexId: p.pokedexId,
      nameFr: p.nameFr,
      generation: p.generation,
      spriteUrl: `/api/pokemon/${p.id}/sprite`,
    };
  }

  /** Apparitions actives (non collectées) du jour. Invité : jeu déterministe commun, non persisté. */
  async getSpawns(userId?: string): Promise<PokedexSpawnDTO[]> {
    const now = new Date();
    const catalog = await this.catalog();
    const byId = new Map(catalog.map((p) => [p.id, p]));

    if (!userId) {
      const dayStr = this.dayStr(now);
      const rng = this.makeRng(this.hashSeed(`guest:${dayStr}`));
      const picks = this.pickDistinct(
        catalog.map((p) => p.id),
        this.DAILY_COUNT,
        rng,
      );
      const zones = this.pickDistinct([...POKEDEX_ZONES], picks.length, rng);
      const out: PokedexSpawnDTO[] = [];
      for (let i = 0; i < picks.length; i++) {
        const p = byId.get(picks[i]!);
        if (!p) continue;
        const token = this.guestToken(p.id, dayStr);
        const sessionHash = this.guestSessionHash(token);
        await this.spriteProxy.registerSpriteSession(sessionHash, p.id, p.spriteRegular, this.SPRITE_TTL_SECONDS);
        out.push({
          token,
          zone: zones[i]!,
          corner: this.cornerFor(token),
          spriteProxyUrl: `/api/sprites/${sessionHash}`,
        });
      }
      return out;
    }

    await this.ensureDailySpawns(userId, now, catalog);
    const spawns = await this.prisma.pokedexSpawn.findMany({
      where: { userId, dayDate: this.utcDateOnly(now), collected: false },
    });
    const out: PokedexSpawnDTO[] = [];
    for (const s of spawns) {
      const p = byId.get(s.pokemonId);
      if (!p) continue;
      await this.spriteProxy.registerSpriteSession(s.sessionHash, p.id, p.spriteRegular, this.SPRITE_TTL_SECONDS);
      out.push({
        token: s.token,
        zone: s.zone,
        corner: this.cornerFor(s.token),
        spriteProxyUrl: `/api/sprites/${s.sessionHash}`,
      });
    }
    return out;
  }

  // Génère les 10 apparitions du jour si elles n'existent pas encore (exclut les Pokémon déjà possédés).
  private async ensureDailySpawns(userId: string, now: Date, catalog: PoolPokemon[]): Promise<void> {
    const dayDate = this.utcDateOnly(now);
    const existing = await this.prisma.pokedexSpawn.count({ where: { userId, dayDate } });
    if (existing > 0) return;

    const owned = await this.prisma.userPokedexEntry.findMany({
      where: { userId },
      select: { pokemonId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.pokemonId));
    const pool = catalog.map((p) => p.id).filter((id) => !ownedSet.has(id));
    if (pool.length === 0) return; // collection complète

    const rng = this.makeRng(this.hashSeed(`${userId}:${this.dayStr(now)}`));
    const picks = this.pickDistinct(pool, this.DAILY_COUNT, rng);
    const zones = this.pickDistinct([...POKEDEX_ZONES], picks.length, rng);
    const data = picks.map((pokemonId, i) => ({
      userId,
      dayDate,
      zone: zones[i]!,
      pokemonId,
      sessionHash: uuidv4().replace(/-/g, '').slice(0, 16),
      token: uuidv4(),
    }));
    // skipDuplicates : couvre une course entre deux requêtes simultanées (contrainte unique par zone).
    await this.prisma.pokedexSpawn.createMany({ data, skipDuplicates: true });
  }

  /** Collecte une apparition via son jeton. Idempotent. Invité : révèle mais n'enregistre pas. */
  async collect(token: string, userId?: string): Promise<PokedexCollectResponse> {
    const now = new Date();
    const catalog = await this.catalog();
    const byId = new Map(catalog.map((p) => [p.id, p]));

    const guest = this.parseGuestToken(token);
    if (guest) {
      const p = byId.get(guest.pokemonId);
      if (!p) return { collected: false, requiresLogin: !userId, pokemon: null };
      // Pas de revealSpriteSession ici : la série du jour est commune à tous les invités, donc le
      // sessionHash l'est aussi. Démasquer priverait les autres de leur silhouette. La révélation
      // passe par le sprite public renvoyé dans la réponse, qui ne concerne que ce joueur.
      return { collected: false, requiresLogin: !userId, pokemon: this.revealed(p) };
    }

    const spawn = await this.prisma.pokedexSpawn.findUnique({ where: { token } });
    if (!spawn || !userId || spawn.userId !== userId) {
      return { collected: false, requiresLogin: !userId, pokemon: null };
    }
    const p = byId.get(spawn.pokemonId);
    if (!p) return { collected: false, requiresLogin: false, pokemon: null };

    await this.spriteProxy.revealSpriteSession(spawn.sessionHash);
    if (spawn.collected) {
      return { collected: false, requiresLogin: false, pokemon: this.revealed(p) };
    }

    await this.prisma.pokedexSpawn.update({
      where: { id: spawn.id },
      data: { collected: true, collectedAt: now },
    });
    try {
      await this.prisma.userPokedexEntry.create({
        data: { userId, pokemonId: p.id, source: this.EASTER_EGG_SOURCE },
      });
    } catch (error) {
      // Doublon (déjà possédé via une autre source) : on garde l'entrée existante.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
    return { collected: true, requiresLogin: false, pokemon: this.revealed(p) };
  }

  /** État de la collection du joueur (total, collectés, non consultés pour la pastille). */
  async getCollection(userId: string): Promise<PokedexCollectionDTO> {
    const [total, entries] = await Promise.all([
      this.prisma.pokemon.count(),
      this.prisma.userPokedexEntry.findMany({ where: { userId }, select: { pokemonId: true, seen: true } }),
    ]);
    const collectedIds = entries.map((e) => e.pokemonId);
    const newCount = entries.filter((e) => !e.seen).length;
    return { total, collectedCount: collectedIds.length, newCount, collectedIds };
  }

  /** Marque tout comme consulté (efface la pastille) quand le joueur ouvre son Pokédex. */
  async markSeen(userId: string): Promise<void> {
    await this.prisma.userPokedexEntry.updateMany({
      where: { userId, seen: false },
      data: { seen: true },
    });
  }

  /** Catalogue complet (grille du Pokédex) : infos de base des espèces. */
  async getCatalog(): Promise<PokedexCatalogEntry[]> {
    const catalog = await this.catalog();
    return catalog.map((p) => ({
      id: p.id,
      pokedexId: p.pokedexId,
      nameFr: p.nameFr,
      generation: p.generation,
    }));
  }

  /**
   * Fiche détaillée, réservée aux Pokémon collectés (les autres restent un mystère).
   * Invité : la preuve de collecte est le jeton signé remis à l'apparition, que le navigateur
   * conserve. Il est vérifié côté serveur, le client ne peut donc pas réclamer une fiche au hasard.
   */
  async getDetail(pokemonId: number, userId?: string, guestToken?: string): Promise<PokedexDetailDTO> {
    if (userId) {
      const owned = await this.prisma.userPokedexEntry.findFirst({ where: { userId, pokemonId } });
      if (!owned) throw new NotFoundException('Pokémon non collecté');
    } else {
      const guest = guestToken ? this.parseGuestToken(guestToken) : null;
      if (!guest || guest.pokemonId !== pokemonId) throw new NotFoundException('Pokémon non collecté');
    }
    const p = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      include: { types: { include: { type: true }, orderBy: { slot: 'asc' } } },
    });
    if (!p) throw new NotFoundException('Pokémon introuvable');
    return {
      id: p.id,
      pokedexId: p.pokedexId,
      nameFr: p.nameFr,
      nameEn: p.nameEn,
      category: p.category,
      generation: p.generation,
      height: p.height,
      weight: p.weight,
      spriteUrl: `/api/pokemon/${p.id}/sprite`,
      types: p.types.map((pt) => ({ nameFr: pt.type.nameFr, image: pt.type.image })),
      stats: {
        hp: p.statsHp,
        atk: p.statsAtk,
        def: p.statsDef,
        speAtk: p.statsSpeAtk,
        speDef: p.statsSpeDef,
        speed: p.statsSpeed,
      },
    };
  }
}
