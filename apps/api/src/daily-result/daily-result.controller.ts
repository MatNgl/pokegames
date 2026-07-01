import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DailyResultService, type DailyResultRow } from './daily-result.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  DailyResultDTO,
  DailyStatusResponse,
  LeaderboardResponse,
} from '@pokegames/shared-types';

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

  /** Classement du jour d'un defi (jeu x scope). Public ; marque l'entree du joueur connecte. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('leaderboard')
  async leaderboard(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Query('game') game: string,
    @Query('scope') scope?: string,
  ): Promise<LeaderboardResponse> {
    const gameType = game ?? '';
    const scopeValue = scope ?? '';
    const rows = await this.dailyResult.leaderboard(gameType, scopeValue, new Date());
    const meId = req.user?.id;
    return {
      gameType,
      scope: scopeValue,
      entries: rows.map((row, index) => ({
        rank: index + 1,
        username: row.username,
        isMe: Boolean(meId) && row.userId === meId,
        won: row.won ?? false,
        attempts: row.attempts ?? null,
        score: row.score ?? null,
        correctCount: row.correctCount ?? null,
        totalRounds: row.totalRounds ?? null,
        durationSeconds: row.durationSeconds ?? null,
      })),
    };
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
