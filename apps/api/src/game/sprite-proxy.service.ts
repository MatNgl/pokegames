import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';

export interface SpriteSessionData {
  pokemonId: number;
  spriteUrl: string;
  isRevealed: boolean;
}

@Injectable()
export class SpriteProxyService {
  private readonly REDIS_PREFIX = 'sprite_session:';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Enregistre un mapping temporaire entre un hash unique et le sprite d'un Pokémon.
   */
  async registerSpriteSession(sessionHash: string, pokemonId: number, spriteUrl: string, ttlSeconds = 600): Promise<void> {
    const data: SpriteSessionData = {
      pokemonId,
      spriteUrl,
      isRevealed: false,
    };
    await this.redisService.set(`${this.REDIS_PREFIX}${sessionHash}`, JSON.stringify(data), ttlSeconds);
  }

  /**
   * Marque le sprite de la session comme révélé (fin de round ou victoire).
   */
  async revealSpriteSession(sessionHash: string): Promise<void> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${sessionHash}`);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SpriteSessionData;
      data.isRevealed = true;
      await this.redisService.set(`${this.REDIS_PREFIX}${sessionHash}`, JSON.stringify(data), 600);
    } catch {
      // Ignorer erreur de parsing
    }
  }

  /**
   * Récupère le buffer de l'image via le sessionHash, en masquant toute métadonnée.
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

    // Récupérer l'image source
    const response = await axios.get<ArrayBuffer>(data.spriteUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] ?? 'image/png');

    return { buffer, contentType };
  }
}
