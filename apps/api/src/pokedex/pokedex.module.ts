import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { PokedexService } from './pokedex.service';
import { PokedexController } from './pokedex.controller';

// GameModule exporte SpriteProxyService (silhouettes masquées réutilisées pour les easter eggs).
@Module({
  imports: [GameModule],
  controllers: [PokedexController],
  providers: [PokedexService],
})
export class PokedexModule {}
