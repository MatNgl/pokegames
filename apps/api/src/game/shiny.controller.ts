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
import { ShinyService } from './shiny.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  ShinyChoiceRequest,
  ShinyChoiceResponse,
  ShinyMode,
  ShinyRoundState,
  ShinyStartRequest,
} from '@pokegames/shared-types';

interface AuthenticatedUser {
  id: string;
}

const SHINY_MODES: ShinyMode[] = ['FIND_SHINY', 'FIND_NON_SHINY'];

@Controller('games/shiny')
export class ShinyController {
  constructor(private readonly shinyService: ShinyService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('start')
  async start(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Body() body: Partial<ShinyStartRequest>,
  ): Promise<ShinyRoundState> {
    const mode = body.mode;
    if (!mode || !SHINY_MODES.includes(mode)) {
      throw new BadRequestException('Mode invalide');
    }
    const level = body.level ?? 'FACILE';
    return this.shinyService.startDaily(mode, level, req.user?.id);
  }

  @Get('round/:roundId')
  async getRoundState(@Param('roundId') roundId: string): Promise<ShinyRoundState> {
    return this.shinyService.getRoundState(roundId);
  }

  @Get('tile/:roundId/:roundIndex/:slot')
  async getTile(
    @Param('roundId') roundId: string,
    @Param('roundIndex', ParseIntPipe) roundIndex: number,
    @Param('slot', ParseIntPipe) slot: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, contentType } = await this.shinyService.getTile(roundId, roundIndex, slot);
      // Anti-triche : aucun en-tete ni nom de fichier ne doit trahir la nature shiny de la vignette.
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
    @Body() body: ShinyChoiceRequest,
  ): Promise<ShinyChoiceResponse> {
    return this.shinyService.submitChoice(body.roundId, body.slot, req.user?.id);
  }
}
