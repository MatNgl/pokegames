import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANTI_REPEAT_DETAIL_WINDOW_DAYS,
  ANTI_REPEAT_WINDOW_DAYS,
  INTRUDER_CONFIG,
  JUST_STAT_CONFIG,
  MOTUS_ADMIN_CONFIG,
  PLUS_MINUS_CONFIG,
  SHINY_CONFIG,
  TRUE_SHINY_CONFIG,
  WHO_IS_IT_ADMIN_CONFIG,
  type IntruderConfig,
  type JustStatConfig,
  type MotusAdminConfig,
  type PlusMinusConfig,
  type ShinyConfig,
  type TrueShinyConfig,
  type WhoIsItAdminConfig,
} from '../game/game-config';

export interface AntiRepeatConfig {
  windows: Record<string, number>;
  detailWindow: number;
}

export type GameConfigKey =
  | 'WHO_IS_IT'
  | 'MOTUS'
  | 'PLUS_MINUS'
  | 'INTRUDER'
  | 'SHINY'
  | 'TRUE_SHINY'
  | 'JUST_STAT'
  | 'ANTI_REPEAT';

// Valeurs par defaut : ne servent qu'au seed initial. Apres seed, la base est la source de verite.
const DEFAULTS: Record<GameConfigKey, unknown> = {
  WHO_IS_IT: WHO_IS_IT_ADMIN_CONFIG,
  MOTUS: MOTUS_ADMIN_CONFIG,
  PLUS_MINUS: PLUS_MINUS_CONFIG,
  INTRUDER: INTRUDER_CONFIG,
  SHINY: SHINY_CONFIG,
  TRUE_SHINY: TRUE_SHINY_CONFIG,
  JUST_STAT: JUST_STAT_CONFIG,
  ANTI_REPEAT: { windows: ANTI_REPEAT_WINDOW_DAYS, detailWindow: ANTI_REPEAT_DETAIL_WINDOW_DAYS },
};

const KEYS = Object.keys(DEFAULTS) as GameConfigKey[];

/**
 * Source de verite unique des parametres de jeu. Charge la config en memoire au demarrage (seed
 * depuis DEFAULTS si absente en base), et l'expose aux services via des getters synchrones. L'admin
 * peut la modifier a chaud (update) : la base et le cache sont mis a jour, les services suivent.
 */
@Injectable()
export class GameConfigService implements OnModuleInit {
  private cache = new Map<GameConfigKey, unknown>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const rows = await this.prisma.gameConfig.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    for (const key of KEYS) {
      if (byKey.has(key)) {
        this.cache.set(key, byKey.get(key));
      } else {
        // Seed initial de la cle manquante avec sa valeur par defaut.
        await this.prisma.gameConfig.create({
          data: { key, value: DEFAULTS[key] as Prisma.InputJsonValue },
        });
        this.cache.set(key, DEFAULTS[key]);
      }
    }
  }

  private get<T>(key: GameConfigKey): T {
    return (this.cache.get(key) ?? DEFAULTS[key]) as T;
  }

  whoIsIt(): WhoIsItAdminConfig {
    return this.get<WhoIsItAdminConfig>('WHO_IS_IT');
  }
  motus(): MotusAdminConfig {
    return this.get<MotusAdminConfig>('MOTUS');
  }
  plusMinus(): PlusMinusConfig {
    return this.get<PlusMinusConfig>('PLUS_MINUS');
  }
  intruder(): IntruderConfig {
    return this.get<IntruderConfig>('INTRUDER');
  }
  shiny(): ShinyConfig {
    return this.get<ShinyConfig>('SHINY');
  }
  trueShiny(): TrueShinyConfig {
    return this.get<TrueShinyConfig>('TRUE_SHINY');
  }
  justStat(): JustStatConfig {
    return this.get<JustStatConfig>('JUST_STAT');
  }
  antiRepeatWindow(game: string): number {
    return this.get<AntiRepeatConfig>('ANTI_REPEAT').windows[game] ?? 30;
  }
  antiRepeatDetailWindow(): number {
    return this.get<AntiRepeatConfig>('ANTI_REPEAT').detailWindow;
  }

  /** Toutes les configs (admin). */
  async getAll(): Promise<{ key: string; value: unknown; updatedAt: string }[]> {
    const rows = await this.prisma.gameConfig.findMany({ orderBy: { key: 'asc' } });
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt.toISOString() }));
  }

  /** Met a jour une cle de config (admin) : persiste + rafraichit le cache. */
  async update(key: string, value: unknown): Promise<void> {
    if (!KEYS.includes(key as GameConfigKey)) {
      throw new BadRequestException('Clé de configuration inconnue');
    }
    await this.prisma.gameConfig.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
    this.cache.set(key as GameConfigKey, value);
  }
}
