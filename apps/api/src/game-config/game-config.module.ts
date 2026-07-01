import { Global, Module } from '@nestjs/common';
import { GameConfigService } from './game-config.service';

// Global : tous les services de jeu injectent GameConfigService sans import de module.
@Global()
@Module({
  providers: [GameConfigService],
  exports: [GameConfigService],
})
export class GameConfigModule {}
