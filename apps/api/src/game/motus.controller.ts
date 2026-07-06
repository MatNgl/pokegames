import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { MotusService } from './motus.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { playerFromRequest } from '../common/player-identity';
import type {
  MotusGuessRequest,
  MotusGuessResponse,
  MotusRoundState,
  MotusLevel,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/motus')
export class MotusController {
  constructor(private readonly motusService: MotusService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body?: { level?: MotusLevel },
  ): Promise<MotusRoundState> {
    return this.motusService.startDaily(body?.level, playerFromRequest(req));
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<MotusRoundState> {
    return this.motusService.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('guess')
  async submitGuess(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: MotusGuessRequest,
  ): Promise<MotusGuessResponse> {
    return this.motusService.submitGuess(body.roundId, body.guess, req.user?.id);
  }
}
