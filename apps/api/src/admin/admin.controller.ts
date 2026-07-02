import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminAuditLogEntry, AdminPage, AdminStats } from '@pokegames/shared-types';

const AUDIT_PAGE_SIZE = 20;

@UseGuards(AdminGuard)
@Controller('admin/audit')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async getAuditLogs(
    @Query('gameType') gameType?: string,
    @Query('page') page = '1',
  ): Promise<AdminPage<AdminAuditLogEntry>> {
    const pageNum = Math.max(1, Number(page) || 1);
    const where = gameType ? { gameType } : {};
    const [rows, total] = await Promise.all([
      this.prisma.gameAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
      }),
      this.prisma.gameAuditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
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
      })),
      total,
      page: pageNum,
      pageSize: AUDIT_PAGE_SIZE,
    };
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
