import { Module } from '@nestjs/common';
import { SpriteProxyService } from './sprite-proxy.service';
import { SpriteProxyController } from './sprite-proxy.controller';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItController } from './who-is-it.controller';

@Module({
  controllers: [SpriteProxyController, WhoIsItController],
  providers: [SpriteProxyService, WhoIsItService],
  exports: [SpriteProxyService, WhoIsItService],
})
export class GameModule {}
