import { Module } from '@nestjs/common';
import { SpriteProxyService } from './sprite-proxy.service';
import { SpriteProxyController } from './sprite-proxy.controller';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItController } from './who-is-it.controller';
import { MotusService } from './motus.service';
import { MotusController } from './motus.controller';

@Module({
  controllers: [SpriteProxyController, WhoIsItController, MotusController],
  providers: [SpriteProxyService, WhoIsItService, MotusService],
  exports: [SpriteProxyService, WhoIsItService, MotusService],
})
export class GameModule {}
