import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGamesController } from './admin-games.controller';

@Module({
  controllers: [AdminController, AdminGamesController],
})
export class AdminModule {}
