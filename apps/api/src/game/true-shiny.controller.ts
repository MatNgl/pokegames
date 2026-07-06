import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TrueShinyService } from './true-shiny.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { playerFromRequest } from '../common/player-identity';
import type {
  TrueShinyChoiceRequest,
  TrueShinyChoiceResponse,
  TrueShinyLevel,
  TrueShinyRoundState,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

const TRUE_SHINY_LEVELS: TrueShinyLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE'];

@Controller('games/true-shiny')
export class TrueShinyController {
  constructor(private readonly trueShinyService: TrueShinyService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: { level?: TrueShinyLevel },
  ): Promise<TrueShinyRoundState> {
    const level = body.level;
    if (!level || !TRUE_SHINY_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    return this.trueShinyService.startDaily(level, playerFromRequest(req));
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<TrueShinyRoundState> {
    return this.trueShinyService.getRoundState(roundId);
  }

  @Get('tile/:roundId/:roundIndex/:slot')
  async getTile(
    @Param('roundId') roundId: string,
    @Param('roundIndex', ParseIntPipe) roundIndex: number,
    @Param('slot', ParseIntPipe) slot: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, contentType } = await this.trueShinyService.getTile(roundId, roundIndex, slot);
      // Anti-triche : image deja traitee, aucun en-tete ne trahit la carte intacte.
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Vignette introuvable');
      } else {
        res.status(500).send('Erreur lors du chargement de la vignette');
      }
    }
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('choice')
  async submitChoice(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: TrueShinyChoiceRequest,
  ): Promise<TrueShinyChoiceResponse> {
    return this.trueShinyService.submitChoice(body.roundId, body.slot, req.user?.id);
  }
}
