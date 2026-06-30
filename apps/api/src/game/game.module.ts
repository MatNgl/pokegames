import { Module } from '@nestjs/common';
import { SpriteProxyService } from './sprite-proxy.service';
import { SpriteProxyController } from './sprite-proxy.controller';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItController } from './who-is-it.controller';
import { WhoIsItGateway } from './who-is-it.gateway';

@Module({
  controllers: [SpriteProxyController, WhoIsItController],
  providers: [SpriteProxyService, WhoIsItService, WhoIsItGateway],
  exports: [SpriteProxyService, WhoIsItService],
})
export class GameModule {}
