import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PokedexService } from './pokedex.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type {
  PokedexCatalogEntry,
  PokedexCollectRequest,
  PokedexCollectResponse,
  PokedexCollectionDTO,
  PokedexDetailDTO,
  PokedexSpawnDTO,
} from '@pokegames/shared-types';

interface AuthUser {
  id: string;
}

@Controller('pokedex')
export class PokedexController {
  constructor(private readonly pokedex: PokedexService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('spawns')
  spawns(@Req() req: Request & { user?: AuthUser }): Promise<PokedexSpawnDTO[]> {
    return this.pokedex.getSpawns(req.user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('collect')
  @HttpCode(HttpStatus.OK)
  collect(
    @Req() req: Request & { user?: AuthUser },
    @Body() body: PokedexCollectRequest,
  ): Promise<PokedexCollectResponse> {
    return this.pokedex.collect(body.token, req.user?.id);
  }

  @Get('catalog')
  catalog(): Promise<PokedexCatalogEntry[]> {
    return this.pokedex.getCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('collection')
  collection(@Req() req: Request & { user?: AuthUser }): Promise<PokedexCollectionDTO> {
    return this.pokedex.getCollection(req.user!.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seen')
  @HttpCode(HttpStatus.OK)
  async seen(@Req() req: Request & { user?: AuthUser }): Promise<{ success: true }> {
    await this.pokedex.markSeen(req.user!.id);
    return { success: true };
  }

  // Invité : le jeton signé de l'apparition sert de preuve de collecte (il est vérifié côté serveur).
  @UseGuards(OptionalJwtAuthGuard)
  @Get('detail/:id')
  detail(
    @Req() req: Request & { user?: AuthUser },
    @Param('id') id: string,
    @Query('token') token?: string,
  ): Promise<PokedexDetailDTO> {
    return this.pokedex.getDetail(Number(id), req.user?.id, token);
  }
}
