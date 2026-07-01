import { Module } from '@nestjs/common';
import { PokemonModule } from '../pokemon/pokemon.module';
import { HistoryModule } from '../history/history.module';
import { DailyResultModule } from '../daily-result/daily-result.module';
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
import { JustStatService } from './just-stat.service';
import { JustStatController } from './just-stat.controller';
import { TrueShinyService } from './true-shiny.service';
import { TrueShinyController } from './true-shiny.controller';

@Module({
  imports: [PokemonModule, HistoryModule, DailyResultModule],
  controllers: [
    SpriteProxyController,
    WhoIsItController,
    MotusController,
    PlusMinusController,
    IntruderController,
    ShinyController,
    JustStatController,
    TrueShinyController,
  ],
  providers: [
    SpriteProxyService,
    WhoIsItService,
    MotusService,
    PlusMinusService,
    IntruderService,
    ShinyService,
    JustStatService,
    TrueShinyService,
  ],
  exports: [
    SpriteProxyService,
    WhoIsItService,
    MotusService,
    PlusMinusService,
    IntruderService,
    ShinyService,
    JustStatService,
    TrueShinyService,
  ],
})
export class GameModule {}
