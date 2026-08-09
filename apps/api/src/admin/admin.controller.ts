import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminGamesStatsService } from './admin-games-stats.service';
import { AdminRetentionService } from './admin-retention.service';
import { AdminPokedexStatsService } from './admin-pokedex-stats.service';
import { parsePeriod } from './admin-period';
import type {
  AdminAnomaly,
  AdminAuditLogEntry,
  AdminGamesReport,
  AdminOverview,
  AdminPage,
  AdminPokedexReport,
  AdminRetentionReport,
  AdminStats,
  AdminSystemInfo,
} from '@pokegames/shared-types';

const AUDIT_PAGE_SIZE = 20;

@UseGuards(AdminGuard)
@Controller('admin/audit')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: AdminStatsService,
    private readonly gamesStats: AdminGamesStatsService,
    private readonly retention: AdminRetentionService,
    private readonly pokedexStats: AdminPokedexStatsService,
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

    // GameAuditLog ne stocke que l'userId : on resout les pseudos en une requete pour savoir qui a
    // joue (sinon toutes les parties de joueurs connectes sont anonymes dans l'admin).
    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.username]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        gameType: r.gameType,
        userId: r.userId,
        username: r.userId ? (nameById.get(r.userId) ?? null) : null,
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

  @Get('overview')
  async getOverview(@Query('days') days?: string): Promise<AdminOverview> {
    return this.stats.getOverview(parsePeriod(days));
  }

  @Get('games')
  async getGamesReport(@Query('days') days?: string): Promise<AdminGamesReport> {
    return this.gamesStats.getReport(parsePeriod(days));
  }

  @Get('retention')
  async getRetention(): Promise<AdminRetentionReport> {
    return this.retention.getReport();
  }

  @Get('pokedex')
  async getPokedexReport(): Promise<AdminPokedexReport> {
    return this.pokedexStats.getReport();
  }

  @Get('system')
  async getSystemInfo(): Promise<AdminSystemInfo> {
    return this.pokedexStats.getSystemInfo();
  }
}
