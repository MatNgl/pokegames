import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/audit')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async getAuditLogs(
    @Query('gameType') gameType?: string,
    @Query('limit') limit = '50',
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.gameAuditLog.findMany({
      ...(gameType ? { where: { gameType } } : {}),
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  @Get('stats')
  async getGlobalStats() {
    const totalGames = await this.prisma.gameAuditLog.count();
    const successfulGames = await this.prisma.gameAuditLog.count({
      where: { isSuccess: true },
    });
    return {
      totalGames,
      successfulGames,
      successRate: totalGames > 0 ? ((successfulGames / totalGames) * 100).toFixed(2) + '%' : '0%',
    };
  }
}
