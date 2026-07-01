import { Module } from '@nestjs/common';
import { PokemonModule } from '../pokemon/pokemon.module';
import { SpriteProxyService } from './sprite-proxy.service';
import { SpriteProxyController } from './sprite-proxy.controller';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItController } from './who-is-it.controller';
import { MotusService } from './motus.service';
import { MotusController } from './motus.controller';
import { PlusMinusService } from './plus-minus.service';
import { PlusMinusController } from './plus-minus.controller';
import { IntruderService } from './intruder.service';
import { IntruderController } from './intruder.controller';
import { ShinyService } from './shiny.service';
import { ShinyController } from './shiny.controller';

@Module({
  imports: [PokemonModule],
  controllers: [
    SpriteProxyController,
    WhoIsItController,
    MotusController,
    PlusMinusController,
    IntruderController,
    ShinyController,
  ],
  providers: [
    SpriteProxyService,
    WhoIsItService,
    MotusService,
    PlusMinusService,
    IntruderService,
    ShinyService,
  ],
  exports: [
    SpriteProxyService,
    WhoIsItService,
    MotusService,
    PlusMinusService,
    IntruderService,
    ShinyService,
  ],
})
export class GameModule {}
