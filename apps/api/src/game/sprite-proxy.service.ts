import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import { RedisService } from '../redis/redis.service';

export interface SpriteSessionData {
  pokemonId: number;
  spriteUrl: string;
  isRevealed: boolean;
  // 0 : silhouette noire ; 1 : couleur tres floutee ; 2 : couleur defloutee. Le sprite net n'arrive qu'a la resolution.
  colorLevel: number;
}

type SpriteState = 'silhouette' | 'color1' | 'color2' | 'full';

@Injectable()
export class SpriteProxyService {
  private readonly REDIS_PREFIX = 'sprite_session:';
  private readonly DEFAULT_TTL_SECONDS = 600;

  // Caches en memoire : evite de re-telecharger le sprite externe et de relancer sharp a chaque requete.
  private readonly originalCache = new Map<string, Buffer>();
  private readonly variantCache = new Map<string, Buffer>();
  private readonly ORIGINAL_CACHE_MAX = 1200;
  private readonly VARIANT_CACHE_MAX = 2000;

  constructor(private readonly redisService: RedisService) {}

  async registerSpriteSession(
    sessionHash: string,
    pokemonId: number,
    spriteUrl: string,
    ttlSeconds = this.DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const data: SpriteSessionData = {
      pokemonId,
      spriteUrl,
      isRevealed: false,
      colorLevel: 0,
    };
    await this.redisService.set(`${this.REDIS_PREFIX}${sessionHash}`, JSON.stringify(data), ttlSeconds);
  }

  private async patchSession(sessionHash: string, patch: Partial<SpriteSessionData>): Promise<void> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${sessionHash}`);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SpriteSessionData;
      const updated: SpriteSessionData = { ...data, ...patch };
      await this.redisService.set(
        `${this.REDIS_PREFIX}${sessionHash}`,
        JSON.stringify(updated),
        this.DEFAULT_TTL_SECONDS,
      );
    } catch {
      // Ignorer une session corrompue
    }
  }

  /**
   * Marque le sprite de la session comme révélé (fin de round ou victoire) : le proxy sert alors le sprite couleur net.
   */
  async revealSpriteSession(sessionHash: string): Promise<void> {
    await this.patchSession(sessionHash, { isRevealed: true });
  }

  /**
   * Débloque un niveau de couleur (1 floutée, 2 défloutée). Ne redescend jamais le niveau.
   */
  async setColorLevel(sessionHash: string, level: number): Promise<void> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${sessionHash}`);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SpriteSessionData;
      await this.patchSession(sessionHash, { colorLevel: Math.max(data.colorLevel ?? 0, level) });
    } catch {
      // Ignorer une session corrompue
    }
  }

  private capCache(cache: Map<string, Buffer>, max: number): void {
    if (cache.size <= max) return;
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  private async getOriginalBuffer(spriteUrl: string): Promise<Buffer> {
    const cached = this.originalCache.get(spriteUrl);
    if (cached) return cached;
    const response = await axios.get<ArrayBuffer>(spriteUrl, { responseType: 'arraybuffer' });
    const buffer: Buffer = Buffer.from(response.data);
    this.originalCache.set(spriteUrl, buffer);
    this.capCache(this.originalCache, this.ORIGINAL_CACHE_MAX);
    return buffer;
  }

  private resolveState(data: SpriteSessionData): SpriteState {
    if (data.isRevealed) return 'full';
    if (data.colorLevel >= 2) return 'color2';
    if (data.colorLevel === 1) return 'color1';
    return 'silhouette';
  }

  private async renderVariant(state: SpriteState, original: Buffer): Promise<Buffer> {
    switch (state) {
      case 'full':
        return original;
      case 'color2':
        // Couleur défloutée : flou modéré, la forme et les couleurs ressortent sans rendre l'identité évidente.
        return sharp(original).ensureAlpha().blur(6).png().toBuffer();
      case 'color1':
        // Couleur très floutée : la palette transparait, l'identité reste cachée.
        return sharp(original).ensureAlpha().blur(14).png().toBuffer();
      case 'silhouette':
      default:
        // Silhouette pleine noire : forme via le canal alpha, RGB force a zero (linear, car modulate({brightness:0}) est ignore).
        return sharp(original).ensureAlpha().linear([0, 0, 0, 1], [0, 0, 0, 0]).png().toBuffer();
    }
  }

  /**
   * Récupère le buffer de l'image via le sessionHash, masqué selon l'état de la manche.
   * ANTI-TRICHE (Règle 2) : tant que la manche n'est pas résolue, le sprite net n'est jamais renvoyé.
   * Les variantes sont mises en cache (clé pokemonId + état) pour un rendu quasi instantané.
   */
  async getSpriteBuffer(sessionHash: string): Promise<{ buffer: Buffer; contentType: string }> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${sessionHash}`);
    if (!raw) {
      throw new NotFoundException('Session de sprite introuvable ou expirée');
    }

    let data: SpriteSessionData;
    try {
      data = JSON.parse(raw) as SpriteSessionData;
    } catch {
      throw new NotFoundException('Données de session de sprite corrompues');
    }

    const state = this.resolveState(data);
    const cacheKey = `${data.pokemonId}:${state}`;

    const cachedVariant = this.variantCache.get(cacheKey);
    if (cachedVariant) {
      return { buffer: cachedVariant, contentType: 'image/png' };
    }

    const original = await this.getOriginalBuffer(data.spriteUrl);
    const buffer = await this.renderVariant(state, original);
    this.variantCache.set(cacheKey, buffer);
    this.capCache(this.variantCache, this.VARIANT_CACHE_MAX);

    return { buffer, contentType: 'image/png' };
  }
}
