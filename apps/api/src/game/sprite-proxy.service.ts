import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import { RedisService } from '../redis/redis.service';

export interface SpriteSessionData {
  pokemonId: number;
  spriteUrl: string;
  isRevealed: boolean;
  colorRevealed: boolean;
}

@Injectable()
export class SpriteProxyService {
  private readonly REDIS_PREFIX = 'sprite_session:';
  private readonly DEFAULT_TTL_SECONDS = 600;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Enregistre un mapping temporaire entre un hash unique et le sprite d'un Pokémon.
   */
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
      colorRevealed: false,
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
   * Débloque le niveau de couleur flouté : le proxy sert une version colorée mais fortement floutée,
   * non identifiable, sans jamais exposer le sprite net (anti-triche, Règle 2).
   */
  async revealColorSpriteSession(sessionHash: string): Promise<void> {
    await this.patchSession(sessionHash, { colorRevealed: true });
  }

  /**
   * Récupère le buffer de l'image via le sessionHash, masqué selon l'état de la manche.
   * ANTI-TRICHE (Règle 2) : tant que la manche n'est pas résolue, le sprite net n'est jamais renvoyé.
   * Trois états : silhouette noire, couleur floutée (indice), puis sprite net (résolution).
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

    if (data.colorRevealed) {
      // Couleur conservée mais flou prononcé : la palette transparait, l'identité reste cachée
      buffer = await sharp(buffer).ensureAlpha().blur(14).png().toBuffer();
      return { buffer, contentType: 'image/png' };
    }

    // Silhouette pleine noire : on garde la forme via le canal alpha et on force le RGB a zero.
    // (modulate({ brightness: 0 }) est ignore par sharp quand la valeur vaut 0, d'ou le passage par linear.)
    // Noir : classique "Quel est ce Pokemon" sur l'ecran clair du theme unique.
    buffer = await sharp(buffer)
      .ensureAlpha()
      .linear([0, 0, 0, 1], [0, 0, 0, 0])
      .png()
      .toBuffer();
    return { buffer, contentType: 'image/png' };
  }
}
