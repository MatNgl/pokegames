import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JustStatService } from './just-stat.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  JustStatGuessRequest,
  JustStatGuessResponse,
  JustStatRoundState,
  JustStatTimeoutRequest,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/just-stat')
export class JustStatController {
  constructor(private readonly justStatService: JustStatService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(@Req() req: Request & { user?: AuthenticatedUser }): Promise<JustStatRoundState> {
    return this.justStatService.startDaily(req.user?.id);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<JustStatRoundState> {
    return this.justStatService.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('guess')
  async guess(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: JustStatGuessRequest,
  ): Promise<JustStatGuessResponse> {
    return this.justStatService.guess(body.roundId, body.guessValue, req.user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('timeout')
  async timeout(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: JustStatTimeoutRequest,
  ): Promise<JustStatGuessResponse> {
    return this.justStatService.timeout(body.roundId, req.user?.id);
  }
}
