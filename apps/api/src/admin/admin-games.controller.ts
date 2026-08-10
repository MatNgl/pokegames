import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { GameConfigService, type AdminActor } from '../game-config/game-config.service';
import type { AdminConfigLogEntry, AdminGameConfigEntry } from '@pokegames/shared-types';

/**
 * Configuration dynamique des jeux (source de verite unique). Lecture et edition a chaud : les
 * services de jeu lisent leur config via GameConfigService, plus aucune constante lue directement.
 * Toute modification est validee (bornes) et journalisee avec son auteur.
 */
@UseGuards(AdminGuard)
@Controller('admin/games')
export class AdminGamesController {
  constructor(private readonly gameConfig: GameConfigService) {}

  /** L'AdminGuard a deja valide le JWT : la requete porte le compte auteur du changement. */
  private actor(req: Request): AdminActor | undefined {
    const user = (req as Request & { user?: { id?: string; username?: string } }).user;
    if (!user?.id) return undefined;
    return { id: user.id, username: user.username ?? user.id };
  }

  @Get('config')
  async getAll(): Promise<AdminGameConfigEntry[]> {
    return this.gameConfig.getAll();
  }

  /** Valeurs par defaut, pour montrer a l'admin ce que la remise a zero va restaurer. */
  @Get('config/defaults')
  async getDefaults(): Promise<AdminGameConfigEntry[]> {
    const all = await this.gameConfig.getAll();
    return all.map((c) => ({
      key: c.key,
      value: this.gameConfig.defaults(c.key),
      updatedAt: c.updatedAt,
    }));
  }

  @Get('config/logs')
  async getLogs(@Query('limit') limit?: string): Promise<AdminConfigLogEntry[]> {
    return this.gameConfig.history(Number(limit) || 30);
  }

  @Put('config/:key')
  async update(
    @Param('key') key: string,
    @Body() body: { value: unknown },
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.gameConfig.update(key, body.value, this.actor(req));
    return { ok: true };
  }

  @Post('config/:key/reset')
  async reset(@Param('key') key: string, @Req() req: Request): Promise<{ value: unknown }> {
    const value = await this.gameConfig.reset(key, this.actor(req));
    return { value };
  }
}
