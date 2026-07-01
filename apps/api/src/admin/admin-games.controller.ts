import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { GameConfigService } from '../game-config/game-config.service';
import type { AdminGameConfigEntry } from '@pokegames/shared-types';

/**
 * Configuration dynamique des jeux (source de verite unique). Lecture et edition a chaud : les
 * services de jeu lisent leur config via GameConfigService, plus aucune constante lue directement.
 */
@UseGuards(AdminGuard)
@Controller('admin/games')
export class AdminGamesController {
  constructor(private readonly gameConfig: GameConfigService) {}

  @Get('config')
  async getAll(): Promise<AdminGameConfigEntry[]> {
    return this.gameConfig.getAll();
  }

  @Put('config/:key')
  async update(
    @Param('key') key: string,
    @Body() body: { value: unknown },
  ): Promise<{ ok: true }> {
    await this.gameConfig.update(key, body.value);
    return { ok: true };
  }
}
