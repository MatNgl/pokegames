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

@Injectable()
export class SpriteProxyService {
  private readonly REDIS_PREFIX = 'sprite_session:';
  private readonly DEFAULT_TTL_SECONDS = 600;

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
   * Débloque un niveau de couleur (1 floutée, 2 défloutée) : le proxy sert une version colorée mais non
   * identifiable, sans jamais exposer le sprite net (anti-triche, Règle 2). Ne redescend jamais le niveau.
   */
  async setColorLevel(sessionHash: string, level: number): Promise<void> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${sessionHash}`);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SpriteSessionData;
      const nextLevel = Math.max(data.colorLevel ?? 0, level);
      await this.patchSession(sessionHash, { colorLevel: nextLevel });
    } catch {
      // Ignorer une session corrompue
    }
  }

  /**
   * Récupère le buffer de l'image via le sessionHash, masqué selon l'état de la manche.
   * ANTI-TRICHE (Règle 2) : tant que la manche n'est pas résolue, le sprite net n'est jamais renvoyé.
   * États : silhouette noire, couleur très floutée, couleur défloutée, puis sprite net (résolution).
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

    const response = await axios.get<ArrayBuffer>(data.spriteUrl, { responseType: 'arraybuffer' });
    let buffer: Buffer = Buffer.from(response.data);

    if (data.isRevealed) {
      const contentType = String(response.headers['content-type'] ?? 'image/png');
      return { buffer, contentType };
    }

    if (data.colorLevel >= 2) {
      // Couleur défloutée : flou modéré, l'identité reste difficile mais la forme et les couleurs ressortent.
      buffer = await sharp(buffer).ensureAlpha().blur(6).png().toBuffer();
      return { buffer, contentType: 'image/png' };
    }

    if (data.colorLevel === 1) {
      // Couleur très floutée : la palette transparait, l'identité reste cachée.
      buffer = await sharp(buffer).ensureAlpha().blur(14).png().toBuffer();
      return { buffer, contentType: 'image/png' };
    }

    // Silhouette pleine noire : on garde la forme via le canal alpha et on force le RGB a zero.
    // (modulate({ brightness: 0 }) est ignore par sharp quand la valeur vaut 0, d'ou le passage par linear.)
    buffer = await sharp(buffer)
      .ensureAlpha()
      .linear([0, 0, 0, 1], [0, 0, 0, 0])
      .png()
      .toBuffer();
    return { buffer, contentType: 'image/png' };
  }
}
