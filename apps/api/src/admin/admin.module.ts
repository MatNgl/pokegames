import { Module } from '@nestjs/common';
import { EtlModule } from '../etl/etl.module';
import { AdminController } from './admin.controller';
import { AdminGamesController } from './admin-games.controller';
import { AdminSystemController } from './admin-system.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminGamesStatsService } from './admin-games-stats.service';
import { AdminRetentionService } from './admin-retention.service';
import { AdminPokedexStatsService } from './admin-pokedex-stats.service';
import { AdminEtlService } from './admin-etl.service';

@Module({
  imports: [EtlModule],
  controllers: [
    AdminController,
    AdminGamesController,
    AdminSystemController,
    AdminUsersController,
  ],
  providers: [
    AdminUsersService,
    AdminStatsService,
    AdminGamesStatsService,
    AdminRetentionService,
    AdminPokedexStatsService,
    AdminEtlService,
  ],
})
export class AdminModule {}
