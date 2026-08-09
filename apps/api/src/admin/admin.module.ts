import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGamesController } from './admin-games.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminGamesStatsService } from './admin-games-stats.service';
import { AdminRetentionService } from './admin-retention.service';
import { AdminPokedexStatsService } from './admin-pokedex-stats.service';

@Module({
  controllers: [AdminController, AdminGamesController, AdminUsersController],
  providers: [
    AdminUsersService,
    AdminStatsService,
    AdminGamesStatsService,
    AdminRetentionService,
    AdminPokedexStatsService,
  ],
})
export class AdminModule {}
