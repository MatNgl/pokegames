import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminAuditLogEntry, AdminStats } from '@pokegames/shared-types';

@UseGuards(AdminGuard)
@Controller('admin/audit')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async getAuditLogs(
    @Query('gameType') gameType?: string,
    @Query('limit') limit = '50',
  ): Promise<AdminAuditLogEntry[]> {
    const take = Math.min(Number(limit) || 50, 200);
    const rows = await this.prisma.gameAuditLog.findMany({
      ...(gameType ? { where: { gameType } } : {}),
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      gameType: r.gameType,
      userId: r.userId,
      targetNameFr: r.targetNameFr,
      userGuess: r.userGuess,
      isSuccess: r.isSuccess,
      scoreEarned: r.scoreEarned,
      durationSeconds: r.durationSeconds,
      hintsUsedCount: r.hintsUsedCount,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Get('stats')
  async getGlobalStats(): Promise<AdminStats> {
    const [totalGames, successfulGames, totalUsers] = await Promise.all([
      this.prisma.gameAuditLog.count(),
      this.prisma.gameAuditLog.count({ where: { isSuccess: true } }),
      this.prisma.user.count(),
    ]);
    return {
      totalUsers,
      totalGames,
      successfulGames,
      successRatePct: totalGames > 0 ? Math.round((successfulGames / totalGames) * 100) : 0,
    };
  }
}
