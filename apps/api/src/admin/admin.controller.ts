import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import { AdminStatsService } from './admin-stats.service';
import type {
  AdminAnomaly,
  AdminAuditLogEntry,
  AdminPage,
  AdminStats,
} from '@pokegames/shared-types';

const AUDIT_PAGE_SIZE = 20;

@UseGuards(AdminGuard)
@Controller('admin/audit')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: AdminStatsService,
  ) {}

  @Get('logs')
  async getAuditLogs(
    @Query('gameType') gameType?: string,
    @Query('outcome') outcome?: string,
    @Query('page') page = '1',
  ): Promise<AdminPage<AdminAuditLogEntry>> {
    const pageNum = Math.max(1, Number(page) || 1);
    const where: Prisma.GameAuditLogWhereInput = {
      ...(gameType ? { gameType } : {}),
      ...(outcome === 'success' ? { isSuccess: true } : {}),
      ...(outcome === 'fail' ? { isSuccess: false } : {}),
    };
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
    return this.stats.getStats();
  }

  @Get('anomalies')
  async getAnomalies(): Promise<AdminAnomaly[]> {
    return this.stats.getAnomalies();
  }
}
