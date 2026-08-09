import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createdAtFilter, dayKey, dayRange, pct, periodStart } from './admin-period';
import type {
  AdminAnomaly,
  AdminGameShare,
  AdminGameStat,
  AdminOverview,
  AdminStats,
  AdminTimePoint,
} from '@pokegames/shared-types';

// Une manche resolue plus vite que ce seuil est suspecte (lecture de la reponse, script...).
const FAST_SOLVE_SECONDS = 2;
// A partir de ce nombre de reussites d'affilee sans aucun echec, on signale le compte.
const PERFECT_STREAK_MIN = 15;

interface DurationRow {
  gameType: string;
  durationSeconds: number;
  isSuccess: boolean;
}

/**
 * Statistiques et detection d'anomalies pour l'admin. Exploite GameAuditLog, qui existait jusqu'ici
 * sans usage analytique (Regle 5 : observabilite et detection d'anomalies).
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
      : (sorted[mid] ?? 0);
  }

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [totalGames, successfulGames, totalUsers, gamesToday, newUsers7d, todayUsers, weekUsers, durations] =
      await Promise.all([
        this.prisma.gameAuditLog.count(),
        this.prisma.gameAuditLog.count({ where: { isSuccess: true } }),
        this.prisma.user.count(),
        this.prisma.gameAuditLog.count({ where: { createdAt: { gte: startOfDay } } }),
        this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.gameAuditLog.findMany({
          where: { createdAt: { gte: startOfDay }, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.gameAuditLog.findMany({
          where: { createdAt: { gte: weekAgo }, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.gameAuditLog.findMany({
          select: { gameType: true, durationSeconds: true, isSuccess: true },
        }),
      ]);

    const byGame = new Map<string, DurationRow[]>();
    for (const row of durations) {
      const list = byGame.get(row.gameType) ?? [];
      list.push(row);
      byGame.set(row.gameType, list);
    }
    const perGame: AdminGameStat[] = [...byGame.entries()]
      .map(([gameType, rows]) => ({
        gameType,
        games: rows.length,
        successRatePct: Math.round((rows.filter((r) => r.isSuccess).length / rows.length) * 100),
        medianDurationSeconds: this.median(rows.map((r) => r.durationSeconds)),
      }))
      .sort((a, b) => b.games - a.games);

    return {
      totalUsers,
      totalGames,
      successfulGames,
      successRatePct: totalGames > 0 ? Math.round((successfulGames / totalGames) * 100) : 0,
      activeUsersToday: todayUsers.length,
      activeUsers7d: weekUsers.length,
      gamesToday,
      newUsers7d,
      perGame,
    };
  }

  /**
   * Vue d'ensemble sur une periode : compteurs, frise d'activite jour par jour, part de chaque jeu
   * dans le volume, et progression moyenne du Pokedex.
   */
  async getOverview(days: number, now = new Date()): Promise<AdminOverview> {
    const start = periodStart(days, now);
    const [stats, logs, signups, totalSpecies, entries, collectors] = await Promise.all([
      this.getStats(),
      this.prisma.gameAuditLog.findMany({
        where: createdAtFilter(days, now),
        select: { gameType: true, userId: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: start ? { createdAt: { gte: start } } : {},
        select: { createdAt: true },
      }),
      this.prisma.pokemon.count(),
      this.prisma.userPokedexEntry.count(),
      this.prisma.userPokedexEntry.findMany({ select: { userId: true }, distinct: ['userId'] }),
    ]);

    // Frise continue : un point par jour, meme sans activite, sinon la courbe ment sur les creux.
    const span = days > 0 ? days : this.spanSince(logs, signups, now);
    const byDay = new Map<string, { games: number; players: Set<string>; signups: number }>();
    for (const key of dayRange(span, now)) {
      byDay.set(key, { games: 0, players: new Set(), signups: 0 });
    }
    for (const row of logs) {
      const slot = byDay.get(dayKey(row.createdAt));
      if (!slot) continue;
      slot.games += 1;
      if (row.userId) slot.players.add(row.userId);
    }
    for (const row of signups) {
      const slot = byDay.get(dayKey(row.createdAt));
      if (slot) slot.signups += 1;
    }
    const timeline: AdminTimePoint[] = [...byDay.entries()].map(([date, v]) => ({
      date,
      games: v.games,
      players: v.players.size,
      signups: v.signups,
    }));

    // Part de chaque jeu dans le volume de la periode.
    const counts = new Map<string, number>();
    for (const row of logs) counts.set(row.gameType, (counts.get(row.gameType) ?? 0) + 1);
    const shares: AdminGameShare[] = [...counts.entries()]
      .map(([gameType, games]) => ({ gameType, games, pct: pct(games, logs.length) }))
      .sort((a, b) => b.games - a.games);

    const collectorCount = collectors.length;
    const avgCollected = collectorCount > 0 ? entries / collectorCount : 0;

    return {
      stats,
      timeline,
      shares,
      pokedexAvgCollected: Math.round(avgCollected * 10) / 10,
      pokedexAvgPct: totalSpecies > 0 ? Math.round((avgCollected / totalSpecies) * 1000) / 10 : 0,
      pokedexTotalSpecies: totalSpecies,
    };
  }

  // Nombre de jours a afficher quand la periode est « depuis le debut » (borne a 180 pour rester lisible).
  private spanSince(
    logs: { createdAt: Date }[],
    signups: { createdAt: Date }[],
    now: Date,
  ): number {
    const dates = [...logs, ...signups].map((r) => r.createdAt.getTime());
    if (dates.length === 0) return 30;
    const oldest = Math.min(...dates);
    const days = Math.ceil((now.getTime() - oldest) / (24 * 3600 * 1000)) + 1;
    return Math.min(Math.max(days, 7), 180);
  }

  /** Comptes au comportement suspect : manches trop rapides, ou sans-faute anormalement long. */
  async getAnomalies(): Promise<AdminAnomaly[]> {
    const [fastRows, allRows] = await Promise.all([
      this.prisma.gameAuditLog.findMany({
        where: { isSuccess: true, durationSeconds: { lt: FAST_SOLVE_SECONDS }, userId: { not: null } },
        select: { userId: true, gameType: true, durationSeconds: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.gameAuditLog.findMany({
        where: { userId: { not: null } },
        select: { userId: true, gameType: true, isSuccess: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
    ]);

    const userIds = new Set<string>();
    for (const r of [...fastRows, ...allRows]) if (r.userId) userIds.add(r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, username: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.username]));

    const anomalies: AdminAnomaly[] = [];

    // 1. Manches resolues sous le seuil, regroupees par joueur et par jeu.
    const fastByKey = new Map<string, { count: number; last: Date; min: number }>();
    for (const r of fastRows) {
      const key = `${r.userId}|${r.gameType}`;
      const cur = fastByKey.get(key);
      if (cur) {
        cur.count += 1;
        cur.min = Math.min(cur.min, r.durationSeconds);
        if (r.createdAt > cur.last) cur.last = r.createdAt;
      } else {
        fastByKey.set(key, { count: 1, last: r.createdAt, min: r.durationSeconds });
      }
    }
    for (const [key, v] of fastByKey) {
      const [userId, gameType] = key.split('|');
      anomalies.push({
        kind: 'FAST_SOLVE',
        userId: userId ?? null,
        username: userId ? (nameById.get(userId) ?? null) : null,
        gameType: gameType ?? '',
        detail: `${v.count} manche(s) résolue(s) en moins de ${FAST_SOLVE_SECONDS}s (min ${v.min}s)`,
        count: v.count,
        lastAt: v.last.toISOString(),
      });
    }

    // 2. Series de reussites sans aucun echec (parcours recent du journal, du plus recent au plus ancien).
    const streaks = new Map<string, { streak: number; last: Date }>();
    const flagged = new Set<string>();
    for (const r of allRows) {
      if (!r.userId) continue;
      const cur = streaks.get(r.userId) ?? { streak: 0, last: r.createdAt };
      if (r.isSuccess) {
        cur.streak += 1;
        if (r.createdAt > cur.last) cur.last = r.createdAt;
        streaks.set(r.userId, cur);
        if (cur.streak >= PERFECT_STREAK_MIN && !flagged.has(r.userId)) {
          flagged.add(r.userId);
          anomalies.push({
            kind: 'PERFECT_STREAK',
            userId: r.userId,
            username: nameById.get(r.userId) ?? null,
            gameType: r.gameType,
            detail: `${cur.streak} réussites d'affilée sans échec`,
            count: cur.streak,
            lastAt: cur.last.toISOString(),
          });
        }
      } else {
        streaks.set(r.userId, { streak: 0, last: cur.last });
      }
    }

    return anomalies.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, 50);
  }
}
