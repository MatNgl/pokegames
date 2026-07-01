import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IntruderService } from './intruder.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  IntruderChoiceRequest,
  IntruderChoiceResponse,
  IntruderRoundState,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/intruder')
export class IntruderController {
  constructor(private readonly intruderService: IntruderService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(@Req() req: Request & { user?: AuthenticatedUser }): Promise<IntruderRoundState> {
    return this.intruderService.startDaily(req.user?.id);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<IntruderRoundState> {
    return this.intruderService.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('choice')
  async submitChoice(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: IntruderChoiceRequest,
  ): Promise<IntruderChoiceResponse> {
    return this.intruderService.submitChoice(body.roundId, body.pokemonId, req.user?.id);
  }
}
