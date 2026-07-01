import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DailyResultService, type DailyResultRow } from './daily-result.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { DailyResultDTO, DailyStatusResponse } from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

function toDTO(row: DailyResultRow): DailyResultDTO {
  return {
    gameType: row.gameType,
    scope: row.scope,
    dayDate: row.dayDate.toISOString().slice(0, 10),
    won: row.won ?? false,
    attempts: row.attempts ?? null,
    score: row.score ?? null,
    correctCount: row.correctCount ?? null,
    totalRounds: row.totalRounds ?? null,
    durationSeconds: row.durationSeconds ?? null,
  };
}

@Controller('daily')
export class DailyResultController {
  constructor(private readonly dailyResult: DailyResultService) {}

  /** Statut du jour du joueur connecte (defis termines). Invite : authenticated=false, liste vide. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('status')
  async status(@Req() req: Request & { user?: AuthenticatedUser }): Promise<DailyStatusResponse> {
    if (!req.user?.id) {
      return { authenticated: false, results: [] };
    }
    const rows = await this.dailyResult.listForDay(req.user.id, new Date());
    return { authenticated: true, results: rows.map(toDTO) };
  }

  /** Historique du joueur (Lot 2). */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('history')
  async history(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Query('limit') limit?: string,
  ): Promise<DailyStatusResponse> {
    if (!req.user?.id) {
      return { authenticated: false, results: [] };
    }
    const parsed = Number.parseInt(limit ?? '', 10);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
    const rows = await this.dailyResult.history(req.user.id, take);
    return { authenticated: true, results: rows.map(toDTO) };
  }
}
