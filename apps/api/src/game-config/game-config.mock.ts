import type { GameConfigService } from './game-config.service';
import {
  ANTI_REPEAT_DETAIL_WINDOW_DAYS,
  ANTI_REPEAT_WINDOW_DAYS,
  GUESS_WHO_CONFIG,
  INTRUDER_CONFIG,
  JUST_STAT_CONFIG,
  MOTUS_ADMIN_CONFIG,
  PLUS_MINUS_CONFIG,
  POKEDEX_GAME_CONFIG,
  SHINY_CONFIG,
  TRUE_SHINY_CONFIG,
  WHO_IS_IT_ADMIN_CONFIG,
} from '../game/game-config';

/** Mock de GameConfigService pour les tests : renvoie les valeurs par defaut de game-config.ts. */
export function gameConfigMock(): Partial<GameConfigService> {
  return {
    whoIsIt: () => WHO_IS_IT_ADMIN_CONFIG,
    motus: () => MOTUS_ADMIN_CONFIG,
    plusMinus: () => PLUS_MINUS_CONFIG,
    intruder: () => INTRUDER_CONFIG,
    shiny: () => SHINY_CONFIG,
    trueShiny: () => TRUE_SHINY_CONFIG,
    justStat: () => JUST_STAT_CONFIG,
    guessWho: () => GUESS_WHO_CONFIG,
    pokedex: () => POKEDEX_GAME_CONFIG,
    antiRepeatWindow: (game: string) =>
      (ANTI_REPEAT_WINDOW_DAYS as Record<string, number>)[game] ?? 30,
    antiRepeatDetailWindow: () => ANTI_REPEAT_DETAIL_WINDOW_DAYS,
  };
}
