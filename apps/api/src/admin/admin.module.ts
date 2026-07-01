import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGamesController } from './admin-games.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [AdminController, AdminGamesController, AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
