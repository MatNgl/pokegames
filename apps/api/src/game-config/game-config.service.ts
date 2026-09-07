import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminConfigChange, AdminConfigLogEntry } from '@pokegames/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG_SCHEMAS, formatIssues } from './game-config.schema';
import {
  ANTI_REPEAT_DETAIL_WINDOW_DAYS,
  ANTI_REPEAT_WINDOW_DAYS,
  GUESS_WHO_CONFIG,
  INTRUDER_CONFIG,
  JUST_STAT_CONFIG,
  MOTUS_ADMIN_CONFIG,
  PLUS_MINUS_CONFIG,
  POKEDEX_GAME_CONFIG,
  SHINY_CONFIG,
  TRUE_SHINY_CONFIG,
  WHO_IS_IT_ADMIN_CONFIG,
  type GuessWhoConfig,
  type IntruderConfig,
  type JustStatConfig,
  type MotusAdminConfig,
  type PlusMinusConfig,
  type PokedexGameConfig,
  type ShinyConfig,
  type TrueShinyConfig,
  type WhoIsItAdminConfig,
} from '../game/game-config';

export interface AntiRepeatConfig {
  windows: Record<string, number>;
  detailWindow: number;
}

/** Auteur d'une modification de configuration, fige dans le journal. */
export interface AdminActor {
  id: string;
  username: string;
}

export type GameConfigKey =
  | 'WHO_IS_IT'
  | 'MOTUS'
  | 'PLUS_MINUS'
  | 'INTRUDER'
  | 'SHINY'
  | 'TRUE_SHINY'
  | 'JUST_STAT'
  | 'GUESS_WHO'
  | 'POKEDEX'
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
  GUESS_WHO: GUESS_WHO_CONFIG,
  POKEDEX: POKEDEX_GAME_CONFIG,
  ANTI_REPEAT: { windows: ANTI_REPEAT_WINDOW_DAYS, detailWindow: ANTI_REPEAT_DETAIL_WINDOW_DAYS },
};

const KEYS = Object.keys(DEFAULTS) as GameConfigKey[];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Complete recursivement une valeur stockee avec les cles manquantes des valeurs par defaut, sans
 * jamais ecraser une valeur deja presente (reglee par l'admin). Sert a introduire de nouveaux
 * parametres sans perdre la config existante en base.
 */
function fillMissingDefaults(def: unknown, stored: unknown): { value: unknown; changed: boolean } {
  if (!isPlainObject(def) || !isPlainObject(stored)) {
    return { value: stored, changed: false };
  }
  let changed = false;
  const out: Record<string, unknown> = { ...stored };
  for (const [k, dv] of Object.entries(def)) {
    if (!(k in out)) {
      out[k] = dv;
      changed = true;
    } else {
      const res = fillMissingDefaults(dv, out[k]);
      if (res.changed) {
        out[k] = res.value;
        changed = true;
      }
    }
  }
  return { value: out, changed };
}

/**
 * Source de verite unique des parametres de jeu. Charge la config en memoire au demarrage (seed
 * depuis DEFAULTS si absente en base), et l'expose aux services via des getters synchrones. L'admin
 * peut la modifier a chaud (update) : la base et le cache sont mis a jour, les services suivent.
 */
@Injectable()
export class GameConfigService implements OnModuleInit {
  private readonly logger = new Logger(GameConfigService.name);
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
        // Complete la valeur stockee avec les nouveaux parametres par defaut (sans ecraser l'existant).
        const { value, changed } = fillMissingDefaults(DEFAULTS[key], byKey.get(key));
        if (changed) {
          await this.prisma.gameConfig.update({
            where: { key },
            data: { value: value as Prisma.InputJsonValue },
          });
        }
        this.cache.set(key, value);
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
  guessWho(): GuessWhoConfig {
    return this.get<GuessWhoConfig>('GUESS_WHO');
  }
  pokedex(): PokedexGameConfig {
    return this.get<PokedexGameConfig>('POKEDEX');
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

  private assertKnownKey(key: string): GameConfigKey {
    if (!KEYS.includes(key as GameConfigKey)) {
      throw new BadRequestException('Clé de configuration inconnue');
    }
    return key as GameConfigKey;
  }

  /**
   * Valide une valeur contre le schema de sa cle. Sans cette barriere, l'editeur admin envoie
   * n'importe quoi en base (nombre negatif, champ inconnu, chaine a la place d'un entier) et le jeu
   * casse en production pour tous les joueurs, sans erreur visible.
   */
  private validate(key: GameConfigKey, value: unknown): unknown {
    const result = CONFIG_SCHEMAS[key].safeParse(value);
    if (!result.success) {
      throw new BadRequestException(`Configuration invalide - ${formatIssues(result.error.issues)}`);
    }
    return result.data;
  }

  /** Valeurs par defaut d'une cle (utilisees par la remise a zero et l'affichage des bornes). */
  defaults(key: string): unknown {
    return DEFAULTS[this.assertKnownKey(key)];
  }

  /** Met a jour une cle de config (admin) : valide, persiste, journalise, rafraichit le cache. */
  async update(key: string, value: unknown, admin?: AdminActor): Promise<void> {
    const configKey = this.assertKnownKey(key);
    const parsed = this.validate(configKey, value);
    const before = this.cache.get(configKey) ?? DEFAULTS[configKey];

    await this.prisma.gameConfig.upsert({
      where: { key },
      update: { value: parsed as Prisma.InputJsonValue },
      create: { key, value: parsed as Prisma.InputJsonValue },
    });
    this.cache.set(configKey, parsed);
    await this.log(configKey, 'UPDATE', before, parsed, admin);
  }

  /** Remet une cle a ses valeurs par defaut (sortie de secours apres un reglage malheureux). */
  async reset(key: string, admin?: AdminActor): Promise<unknown> {
    const configKey = this.assertKnownKey(key);
    const before = this.cache.get(configKey) ?? DEFAULTS[configKey];
    const value = DEFAULTS[configKey];

    await this.prisma.gameConfig.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
    this.cache.set(configKey, value);
    await this.log(configKey, 'RESET', before, value, admin);
    return value;
  }

  /**
   * Journalise le changement. Volontairement non bloquant : une panne d'ecriture du journal ne doit
   * pas empecher un administrateur de corriger un reglage qui casse un jeu en production.
   */
  private async log(
    key: GameConfigKey,
    action: 'UPDATE' | 'RESET',
    before: unknown,
    after: unknown,
    admin?: AdminActor,
  ): Promise<void> {
    try {
      await this.prisma.adminConfigLog.create({
        data: {
          key,
          action,
          adminId: admin?.id ?? null,
          adminName: admin?.username ?? 'inconnu',
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Journal de configuration non ecrit (${key}) : ${String(err)}`);
    }
  }

  /** Dernieres modifications de configuration (admin). */
  async history(limit = 30): Promise<AdminConfigLogEntry[]> {
    const rows = await this.prisma.adminConfigLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      action: r.action === 'RESET' ? 'RESET' : 'UPDATE',
      adminName: r.adminName,
      changes: diffPaths(r.before, r.after),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

/**
 * Compare deux configurations et ne retient que les champs qui ont change, chemin complet en clair.
 * Afficher deux objets JSON entiers dans l'admin serait illisible : ce qui compte, c'est
 * "levels.FACILE.gridSize : 3 -> 5".
 */
function diffPaths(before: unknown, after: unknown, prefix = ''): AdminConfigChange[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((k) =>
      diffPaths(before[k], after[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  const a = JSON.stringify(before);
  const b = JSON.stringify(after);
  if (a === b) return [];
  return [{ path: prefix, before: a ?? 'null', after: b ?? 'null' }];
}
