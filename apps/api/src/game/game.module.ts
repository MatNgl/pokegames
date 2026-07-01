import { Module } from '@nestjs/common';
import { SpriteProxyService } from './sprite-proxy.service';
import { SpriteProxyController } from './sprite-proxy.controller';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItController } from './who-is-it.controller';
import { MotusService } from './motus.service';
import { MotusController } from './motus.controller';
import { PlusMinusService } from './plus-minus.service';
import { PlusMinusController } from './plus-minus.controller';

@Module({
  controllers: [SpriteProxyController, WhoIsItController, MotusController, PlusMinusController],
  providers: [SpriteProxyService, WhoIsItService, MotusService, PlusMinusService],
  exports: [SpriteProxyService, WhoIsItService, MotusService, PlusMinusService],
})
export class GameModule {}
