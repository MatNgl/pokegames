import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminAuditLogEntry,
  AdminPage,
  AdminUserDetail,
  AdminUserSummary,
} from '@pokegames/shared-types';

const USERS_PAGE_SIZE = 20;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Agrege le nombre de parties et le temps joue par utilisateur (depuis le journal d'audit). */
  private async playStatsByUser(): Promise<Map<string, { games: number; time: number }>> {
    const rows = await this.prisma.gameAuditLog.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _count: { _all: true },
      _sum: { durationSeconds: true },
    });
    const map = new Map<string, { games: number; time: number }>();
    for (const row of rows) {
      if (row.userId) {
        map.set(row.userId, { games: row._count._all, time: row._sum.durationSeconds ?? 0 });
      }
    }
    return map;
  }

  async list(
    page = 1,
    search?: string,
    sort: 'recent' | 'games' | 'time' | 'name' = 'recent',
  ): Promise<AdminPage<AdminUserSummary>> {
    const pageNum = Math.max(1, page);
    // Recherche insensible a la casse sur le pseudo ou l'email.
    const q = search?.trim();
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    // Parties jouees et temps joue viennent d'une agregation de GameAuditLog : Prisma ne peut pas
    // trier la requete User dessus. On charge donc la selection, on fusionne, puis on pagine en
    // memoire. Acceptable a l'echelle du projet (quelques centaines de comptes au plus).
    const [users, total, stats] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, username: true, email: true, role: true, createdAt: true },
        orderBy: sort === 'name' ? { username: 'asc' } : { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
      this.playStatsByUser(),
    ]);

    const rows: AdminUserSummary[] = users.map((u) => {
      const s = stats.get(u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        gamesPlayed: s?.games ?? 0,
        totalTimeSeconds: s?.time ?? 0,
      };
    });

    if (sort === 'games') rows.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    if (sort === 'time') rows.sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);

    return {
      items: rows.slice((pageNum - 1) * USERS_PAGE_SIZE, pageNum * USERS_PAGE_SIZE),
      total,
      page: pageNum,
      pageSize: USERS_PAGE_SIZE,
    };
  }

  // username est passe par l'appelant : dans le detail d'un utilisateur, toutes les parties sont
  // les siennes, inutile de refaire une requete par ligne.
  private toAuditEntry(
    row: {
      id: string;
      gameType: string;
      userId: string | null;
      targetNameFr: string;
      userGuess: string | null;
      isSuccess: boolean;
      scoreEarned: number;
      durationSeconds: number;
      hintsUsedCount: number;
      createdAt: Date;
    },
    username: string | null = null,
  ): AdminAuditLogEntry {
    return {
      id: row.id,
      gameType: row.gameType,
      userId: row.userId,
      username,
      targetNameFr: row.targetNameFr,
      userGuess: row.userGuess,
      isSuccess: row.isSuccess,
      scoreEarned: row.scoreEarned,
      durationSeconds: row.durationSeconds,
      hintsUsedCount: row.hintsUsedCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async detail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const [agg, recent, dailyResultsCount, recentDaily, entries, activityDates, species, allCounts] =
      await Promise.all([
        this.prisma.gameAuditLog.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { durationSeconds: true },
        }),
        this.prisma.gameAuditLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.dailyResult.count({ where: { userId } }),
        this.prisma.dailyResult.findMany({
          where: { userId },
          orderBy: [{ dayDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
        }),
        this.prisma.userPokedexEntry.findMany({
          where: { userId },
          select: { pokemonId: true, collectedAt: true },
          orderBy: { collectedAt: 'asc' },
        }),
        this.prisma.gameAuditLog.findMany({
          where: { userId },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.pokemon.findMany({ select: { id: true, generation: true } }),
        this.prisma.gameAuditLog.groupBy({
          by: ['userId'],
          where: { userId: { not: null } },
          _count: { _all: true },
        }),
      ]);

    const streaks = this.streaks(activityDates.map((a) => a.createdAt));
    const pokedex = this.pokedexProgress(entries, species);
    const [pokedexCounts, totalUsers] = await Promise.all([
      this.prisma.userPokedexEntry.groupBy({ by: ['userId'], _count: { _all: true } }),
      this.prisma.user.count(),
    ]);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      gamesPlayed: agg._count._all,
      totalTimeSeconds: agg._sum.durationSeconds ?? 0,
      dailyResultsCount,
      pokedexCount: entries.length,
      recentGames: recent.map((r) => this.toAuditEntry(r, user.username)),
      recentDailyResults: recentDaily.map((d) => ({
        gameType: d.gameType,
        scope: d.scope,
        dayDate: d.dayDate.toISOString().slice(0, 10),
        won: d.won,
        score: d.score,
        attempts: d.attempts,
        correctCount: d.correctCount,
        totalRounds: d.totalRounds,
      })),
      pokedexTotalSpecies: species.length,
      pokedexByGeneration: pokedex.byGeneration,
      pokedexTimeline: pokedex.timeline,
      activeDays: streaks.activeDays,
      currentStreakDays: streaks.current,
      longestStreakDays: streaks.longest,
      lastPlayedAt: streaks.lastPlayedAt,
      percentileGames: this.percentile(
        agg._count._all,
        allCounts.map((c) => c._count._all),
        totalUsers,
      ),
      percentilePokedex: this.percentile(
        entries.length,
        pokedexCounts.map((c) => c._count._all),
        totalUsers,
      ),
    };
  }

  /**
   * Assiduite calculee sur les jours distincts ou le joueur a termine une manche : le projet ne
   * journalise pas les connexions, une partie est donc la seule preuve de presence.
   * La serie en cours reste valide si le joueur a joue hier (la journee d'aujourd'hui n'est pas finie).
   */
  private streaks(dates: Date[]): {
    activeDays: number;
    current: number;
    longest: number;
    lastPlayedAt: string | null;
  } {
    if (dates.length === 0) {
      return { activeDays: 0, current: 0, longest: 0, lastPlayedAt: null };
    }
    const days = [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))].sort();
    const dayMs = 24 * 3600 * 1000;
    const toTime = (s: string) => Date.parse(`${s}T00:00:00Z`);

    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      const gap = (toTime(days[i]!) - toTime(days[i - 1]!)) / dayMs;
      run = gap === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterdayKey = new Date(today.getTime() - dayMs).toISOString().slice(0, 10);
    const last = days[days.length - 1]!;
    let current = 0;
    if (last === todayKey || last === yesterdayKey) {
      current = 1;
      for (let i = days.length - 1; i > 0; i--) {
        const gap = (toTime(days[i]!) - toTime(days[i - 1]!)) / dayMs;
        if (gap !== 1) break;
        current += 1;
      }
    }

    const lastDate = dates.reduce((a, b) => (a > b ? a : b));
    return { activeDays: days.length, current, longest, lastPlayedAt: lastDate.toISOString() };
  }

  /** Captures par generation et courbe cumulee dans le temps. */
  private pokedexProgress(
    entries: { pokemonId: number; collectedAt: Date }[],
    species: { id: number; generation: number }[],
  ): {
    byGeneration: { generation: number; collected: number; total: number }[];
    timeline: { date: string; total: number }[];
  } {
    const genById = new Map(species.map((s) => [s.id, s.generation]));
    const totals = new Map<number, number>();
    for (const s of species) totals.set(s.generation, (totals.get(s.generation) ?? 0) + 1);

    const collected = new Map<number, number>();
    for (const e of entries) {
      const gen = genById.get(e.pokemonId);
      if (gen === undefined) continue;
      collected.set(gen, (collected.get(gen) ?? 0) + 1);
    }

    const byGeneration = [...totals.entries()]
      .map(([generation, total]) => ({
        generation,
        total,
        collected: collected.get(generation) ?? 0,
      }))
      .sort((a, b) => a.generation - b.generation);

    // Courbe cumulee : un point par jour de capture.
    const perDay = new Map<string, number>();
    for (const e of entries) {
      const key = e.collectedAt.toISOString().slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    let running = 0;
    const timeline = [...perDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, n]) => {
        running += n;
        return { date, total: running };
      });

    return { byGeneration, timeline };
  }

  /**
   * Centile du joueur : part des comptes qu'il devance.
   *
   * `population` ne contient que les joueurs ayant au moins une ligne (groupBy) : on complete avec
   * des zeros pour les comptes inactifs, sinon un joueur seul a jouer serait donne a 0 % alors
   * qu'il devance tout le monde.
   */
  private percentile(value: number, population: number[], totalUsers: number): number {
    const zeros = Math.max(0, totalUsers - population.length);
    const full = [...population, ...Array<number>(zeros).fill(0)];
    if (full.length <= 1) return 0;
    // On se compare aux autres, pas a soi-meme.
    const below = full.filter((v) => v < value).length;
    return Math.round((below / (full.length - 1)) * 100);
  }

  /**
   * Change le role d'un compte. Deux garde-fous : un admin ne peut pas se retrograder lui-meme, et
   * on refuse de retirer le dernier administrateur (sinon plus personne n'accede a l'admin).
   */
  async updateRole(userId: string, role: 'USER' | 'ADMIN', actingUserId: string): Promise<void> {
    if (role !== 'USER' && role !== 'ADMIN') {
      throw new BadRequestException('Rôle invalide');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (userId === actingUserId && role !== 'ADMIN') {
      throw new BadRequestException('Tu ne peux pas retirer ton propre accès administrateur');
    }
    if (user.role === 'ADMIN' && role === 'USER') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) {
        throw new BadRequestException('Impossible de retirer le dernier administrateur');
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  /** Supprime un compte et tout ce qui en depend (cascade Prisma). Jamais son propre compte. */
  async remove(userId: string, actingUserId: string): Promise<void> {
    if (userId === actingUserId) {
      throw new BadRequestException('Tu ne peux pas supprimer ton propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.role === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) {
        throw new BadRequestException('Impossible de supprimer le dernier administrateur');
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /** Efface les resultats du jour d'un joueur : lui redonne accès aux defis (support / litige). */
  async resetDaily(userId: string): Promise<number> {
    const today = new Date();
    const dayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const res = await this.prisma.dailyResult.deleteMany({ where: { userId, dayDate } });
    return res.count;
  }
}
