import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { WhoIsItService } from './who-is-it.service';
import { GameConfigService } from '../game-config/game-config.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { playerFromRequest } from '../common/player-identity';
import {
  WhoIsItConfig,
  WhoIsItRoundState,
  WhoIsItGuessRequest,
  WhoIsItHintRequest,
  WhoIsItSkipRequest,
  WhoIsItGuessResponse,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/who-is-it')
export class WhoIsItController {
  constructor(
    private readonly whoIsItService: WhoIsItService,
    private readonly gameConfig: GameConfigService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async startRound(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() config?: Partial<WhoIsItConfig>,
  ): Promise<WhoIsItRoundState> {
    const fullConfig: WhoIsItConfig = {
      generations: config?.generations ?? [],
      mode: config?.mode ?? 'CLASSIC',
      roundsCount: config?.roundsCount ?? this.gameConfig.whoIsIt().roundsCount,
      // exactOptionalPropertyTypes : ne pas assigner explicitement undefined a une propriete optionnelle.
      ...(config?.level ? { level: config.level } : {}),
    };
    return this.whoIsItService.startRound(fullConfig, playerFromRequest(req), config?.roundIndex ?? 1);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<WhoIsItRoundState> {
    return this.whoIsItService.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('hint')
  async requestHint(@Body() body: WhoIsItHintRequest): Promise<WhoIsItRoundState> {
    return this.whoIsItService.requestHint(body.roundId, body.hintType);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('guess')
  async submitGuess(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: WhoIsItGuessRequest,
  ): Promise<WhoIsItGuessResponse> {
    return this.whoIsItService.submitGuess(body.roundId, body.guess, req.user?.id, body.carriedAttempts);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('skip')
  async skipRound(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: WhoIsItSkipRequest,
  ): Promise<WhoIsItGuessResponse> {
    return this.whoIsItService.skipRound(body.roundId, req.user?.id, body.carriedAttempts);
  }
}
