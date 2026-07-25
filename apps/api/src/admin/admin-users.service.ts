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

  async list(page = 1, search?: string): Promise<AdminPage<AdminUserSummary>> {
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
    const [users, total, stats] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, username: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * USERS_PAGE_SIZE,
        take: USERS_PAGE_SIZE,
      }),
      this.prisma.user.count({ where }),
      this.playStatsByUser(),
    ]);
    return {
      items: users.map((u) => {
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
      }),
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

    const [agg, recent, dailyResultsCount, recentDaily, pokedexCount] = await Promise.all([
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
      this.prisma.userPokedexEntry.count({ where: { userId } }),
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
      pokedexCount,
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
    };
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
