import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WhoIsItService } from './who-is-it.service';
import {
  WhoIsItConfig,
  WhoIsItRoundState,
  WhoIsItGuessRequest,
  WhoIsItGuessResponse,
} from '@pokegames/shared-types';

@Controller('games/who-is-it')
export class WhoIsItController {
  constructor(private readonly whoIsItService: WhoIsItService) {}

  @Post('start')
  async startRound(@Body() config?: Partial<WhoIsItConfig>): Promise<WhoIsItRoundState> {
    return this.whoIsItService.startRound(config);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<WhoIsItRoundState> {
    return this.whoIsItService.getRoundState(roundId);
  }

  @Post('guess')
  async submitGuess(@Body() body: WhoIsItGuessRequest): Promise<WhoIsItGuessResponse> {
    return this.whoIsItService.submitGuess(body.roundId, body.guess);
  }
}
