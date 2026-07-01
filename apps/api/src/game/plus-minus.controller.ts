import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PlusMinusService } from './plus-minus.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  PlusMinusChoiceRequest,
  PlusMinusChoiceResponse,
  PlusMinusRoundState,
  PlusMinusStartRequest,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

@Controller('games/plus-minus')
export class PlusMinusController {
  constructor(private readonly plusMinusService: PlusMinusService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: PlusMinusStartRequest,
  ): Promise<PlusMinusRoundState> {
    return this.plusMinusService.startDaily(body.level, req.user?.id);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<PlusMinusRoundState> {
    return this.plusMinusService.getRoundState(roundId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('choice')
  async submitChoice(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: PlusMinusChoiceRequest,
  ): Promise<PlusMinusChoiceResponse> {
    return this.plusMinusService.submitChoice(body.roundId, body.choice, req.user?.id);
  }
}
