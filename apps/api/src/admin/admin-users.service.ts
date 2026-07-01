import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminAuditLogEntry,
  AdminUserDetail,
  AdminUserSummary,
} from '@pokegames/shared-types';

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

  async list(): Promise<AdminUserSummary[]> {
    const [users, stats] = await Promise.all([
      this.prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.playStatsByUser(),
    ]);
    return users.map((u) => {
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
  }

  private toAuditEntry(row: {
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
  }): AdminAuditLogEntry {
    return {
      id: row.id,
      gameType: row.gameType,
      userId: row.userId,
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
        eloScore: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const [agg, recent, dailyResultsCount] = await Promise.all([
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
    ]);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      eloScore: user.eloScore,
      gamesPlayed: agg._count._all,
      totalTimeSeconds: agg._sum.durationSeconds ?? 0,
      dailyResultsCount,
      recentGames: recent.map((r) => this.toAuditEntry(r)),
    };
  }
}
