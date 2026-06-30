import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { WhoIsItService } from './who-is-it.service';
import {
  WhoIsItConfig,
  WhoIsItRoundState,
  WhoIsItGuessRequest,
  WhoIsItHintRequest,
  WhoIsItGuessResponse,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/who-is-it')
export class WhoIsItController {
  constructor(private readonly whoIsItService: WhoIsItService) {}

  @Post('start')
  async startRound(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() config?: Partial<WhoIsItConfig>,
  ): Promise<WhoIsItRoundState> {
    const fullConfig: WhoIsItConfig = {
      generations: config?.generations ?? [],
      mode: config?.mode ?? 'CLASSIC',
      roundsCount: config?.roundsCount ?? 5,
    };
    return this.whoIsItService.startRound(fullConfig, req.user?.id);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<WhoIsItRoundState> {
    return this.whoIsItService.getRoundState(roundId);
  }

  @Post('hint')
  async requestHint(@Body() body: WhoIsItHintRequest): Promise<WhoIsItRoundState> {
    return this.whoIsItService.requestHint(body.roundId, body.hintType);
  }

  @Post('guess')
  async submitGuess(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: WhoIsItGuessRequest,
  ): Promise<WhoIsItGuessResponse> {
    return this.whoIsItService.submitGuess(body.roundId, body.guess, req.user?.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('start/auth')
  async startRoundAuthenticated(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() config?: Partial<WhoIsItConfig>,
  ): Promise<WhoIsItRoundState> {
    const fullConfig: WhoIsItConfig = {
      generations: config?.generations ?? [],
      mode: config?.mode ?? 'CLASSIC',
      roundsCount: config?.roundsCount ?? 5,
    };
    return this.whoIsItService.startRound(fullConfig, req.user?.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('guess/auth')
  async submitGuessAuthenticated(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: WhoIsItGuessRequest,
  ): Promise<WhoIsItGuessResponse> {
    return this.whoIsItService.submitGuess(body.roundId, body.guess, req.user?.id);
  }
}
