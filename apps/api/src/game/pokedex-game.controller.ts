import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PokedexGameService } from './pokedex-game.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { playerFromRequest } from '../common/player-identity';
import type {
  PokedexGuessRequest,
  PokedexGuessResponse,
  PokedexRoundState,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/pokedex')
export class PokedexGameController {
  constructor(private readonly pokedexGame: PokedexGameService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(@Req() req: Request & { user?: AuthenticatedUser }): Promise<PokedexRoundState> {
    return this.pokedexGame.startDaily(playerFromRequest(req));
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<PokedexRoundState> {
    return this.pokedexGame.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('guess')
  async guess(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: PokedexGuessRequest,
  ): Promise<PokedexGuessResponse> {
    return this.pokedexGame.guess(body.roundId, body.name, req.user?.id);
  }
}
