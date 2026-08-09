import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey, pct } from './admin-period';
import type {
  AdminAtRiskUser,
  AdminCohort,
  AdminRetentionReport,
} from '@pokegames/shared-types';

// Nombre de semaines suivies apres l'inscription dans le tableau de cohortes.
const COHORT_WEEKS = 6;
// Au-dela de ce silence, un joueur qui jouait avant est considere comme decrochant.
const AT_RISK_DAYS = 7;

/** Lundi (UTC) de la semaine contenant la date : cle de regroupement des cohortes. */
function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function weeksBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Retention : cohortes hebdomadaires, joueurs qui decrochent, et distribution de l'assiduite.
 * Tout est deduit de GameAuditLog (une partie = une preuve d'activite) : le projet ne journalise
 * pas les connexions.
 */
@Injectable()
export class AdminRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(now = new Date()): Promise<AdminRetentionReport> {
    const [users, logs] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, username: true, createdAt: true } }),
      this.prisma.gameAuditLog.findMany({
        where: { userId: { not: null } },
        select: { userId: true, createdAt: true },
      }),
    ]);

    // Jours d'activite distincts par joueur : base commune aux trois indicateurs.
    const daysByUser = new Map<string, Set<string>>();
    const lastPlayByUser = new Map<string, Date>();
    for (const l of logs) {
      if (!l.userId) continue;
      const set = daysByUser.get(l.userId) ?? new Set<string>();
      set.add(dayKey(l.createdAt));
      daysByUser.set(l.userId, set);
      const last = lastPlayByUser.get(l.userId);
      if (!last || l.createdAt > last) lastPlayByUser.set(l.userId, l.createdAt);
    }

    return {
      cohorts: this.cohorts(users, logs, now),
      atRisk: this.atRisk(users, daysByUser, lastPlayByUser, now),
      daysPlayed: this.daysPlayed(daysByUser),
    };
  }

  /** D1 : part des inscrits d'une semaine encore actifs les semaines suivantes. */
  private cohorts(
    users: { id: string; createdAt: Date }[],
    logs: { userId: string | null; createdAt: Date }[],
    now: Date,
  ): AdminCohort[] {
    const cohortOf = new Map<string, number>(); // userId -> temps du lundi d'inscription
    const members = new Map<number, Set<string>>();
    for (const u of users) {
      const wk = weekStart(u.createdAt).getTime();
      cohortOf.set(u.id, wk);
      const set = members.get(wk) ?? new Set<string>();
      set.add(u.id);
      members.set(wk, set);
    }

    // Pour chaque cohorte, les joueurs actifs a la semaine N+k.
    const active = new Map<string, Set<string>>(); // `${wk}|${offset}` -> userIds
    for (const l of logs) {
      if (!l.userId) continue;
      const wk = cohortOf.get(l.userId);
      if (wk === undefined) continue;
      const offset = weeksBetween(new Date(wk), weekStart(l.createdAt));
      if (offset < 0 || offset >= COHORT_WEEKS) continue;
      const key = `${wk}|${offset}`;
      const set = active.get(key) ?? new Set<string>();
      set.add(l.userId);
      active.set(key, set);
    }

    const currentWeek = weekStart(now).getTime();
    return [...members.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 8)
      .map(([wk, ids]) => ({
        week: dayKey(new Date(wk)),
        size: ids.size,
        // null quand la semaine n'est pas encore ecoulee : on n'affiche pas un 0 % trompeur.
        retentionPct: Array.from({ length: COHORT_WEEKS }, (_, k) => {
          const weekOfOffset = wk + k * 7 * 24 * 3600 * 1000;
          if (weekOfOffset > currentWeek) return null;
          return pct(active.get(`${wk}|${k}`)?.size ?? 0, ids.size);
        }),
      }));
  }

  /** D2 : joueurs qui jouaient et ne sont plus revenus depuis une semaine. */
  private atRisk(
    users: { id: string; username: string }[],
    daysByUser: Map<string, Set<string>>,
    lastPlayByUser: Map<string, Date>,
    now: Date,
  ): AdminAtRiskUser[] {
    return users
      .map((u) => {
        const last = lastPlayByUser.get(u.id) ?? null;
        const games = daysByUser.get(u.id)?.size ?? 0;
        const daysSince = last
          ? Math.floor((now.getTime() - last.getTime()) / (24 * 3600 * 1000))
          : null;
        return {
          id: u.id,
          username: u.username,
          lastPlayedAt: last ? last.toISOString() : null,
          daysSinceLastPlay: daysSince,
          gamesPlayed: games,
        };
      })
      .filter((u) => u.daysSinceLastPlay !== null && u.daysSinceLastPlay >= AT_RISK_DAYS)
      .sort((a, b) => (a.daysSinceLastPlay ?? 0) - (b.daysSinceLastPlay ?? 0))
      .slice(0, 20);
  }

  /** D3 : combien de joueurs ont joue 1 jour, 2 jours, etc. */
  private daysPlayed(daysByUser: Map<string, Set<string>>): { days: number; users: number }[] {
    const counts = new Map<number, number>();
    for (const set of daysByUser.values()) {
      counts.set(set.size, (counts.get(set.size) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([days, users]) => ({ days, users }))
      .sort((a, b) => a.days - b.days);
  }
}
