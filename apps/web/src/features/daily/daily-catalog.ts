import type { DailyResultDTO } from '@pokegames/shared-types';

import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import findNotShinyImg from '@/assets/games/find_not_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';
import quiEstCeImg from '@/assets/games/quiestce.png';

// Libelles d'affichage partages pour l'historique et les quetes (source unique cote front).
export const GAME_LABELS: Record<string, string> = {
  WHO_IS_IT: 'Quel est ce Pokémon',
  MOTUS: 'Poké-Motus',
  PLUS_MINUS: 'Plus ou Moins',
  INTRUDER: "L'Intrus",
  SHINY: 'Trouve le shiny',
  TRUE_SHINY: 'Le Bon Shiny',
  JUST_STAT: 'La Juste Stat',
};

const LEVEL_LABELS: Record<string, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
  EXTREME: 'Extrême',
};

const MODE_LABELS: Record<string, string> = {
  FIND_SHINY: 'Shiny',
  FIND_NON_SHINY: 'Non-Shiny',
};

export function gameLabel(gameType: string, scope?: string): string {
  if (gameType === 'SHINY' && scope?.startsWith('FIND_NON_SHINY')) {
    return 'Trouve le non-shiny';
  }
  return GAME_LABELS[gameType] ?? gameType;
}

/** Formate le scope (niveau et/ou mode) d'un defi en libelle lisible. */
export function scopeLabel(scope: string): string {
  if (!scope) return '';
  if (scope.includes(':')) {
    const [mode, level] = scope.split(':');
    if (mode === 'FIND_SHINY' || mode === 'FIND_NON_SHINY') {
      return level ? (LEVEL_LABELS[level] ?? level) : '';
    }
    const modeLabel = mode ? (MODE_LABELS[mode] ?? mode) : '';
    const lvlLabel = level ? (LEVEL_LABELS[level] ?? level) : '';
    return [modeLabel, lvlLabel].filter(Boolean).join(' · ');
  }
  return LEVEL_LABELS[scope] ?? scope;
}

export function gameIconImg(gameType: string, scope?: string): string {
  if (gameType === 'SHINY') {
    if (scope && scope.startsWith('FIND_NON_SHINY')) return findNotShinyImg;
    return findShinyImg;
  }
  switch (gameType) {
    case 'WHO_IS_IT':
      return whoIsItImg;
    case 'MOTUS':
      return pokeMotusImg;
    case 'PLUS_MINUS':
      return plusMinusImg;
    case 'INTRUDER':
      return intrusImg;
    case 'TRUE_SHINY':
      return leBonShinyImg;
    case 'JUST_STAT':
      return justPriceImg;
    case 'GUESS_WHO':
      return quiEstCeImg;
    default:
      return whoIsItImg;
  }
}

type MetricFields = Pick<
  DailyResultDTO,
  'won' | 'attempts' | 'score' | 'correctCount' | 'totalRounds'
>;

/** Metrique d'affichage selon le jeu (essais, score, bonnes reponses). */
export function resultMetric(result: MetricFields): string {
  if (result.attempts != null) {
    return result.won ? ` ${result.attempts} essai${result.attempts > 1 ? 's' : ''}` : 'Perdu';
  }
  if (result.correctCount != null && result.totalRounds != null) {
    return `${result.correctCount}/${result.totalRounds} bonnes réponses`;
  }
  if (result.score != null) {
    return result.won ? `Réussi (${result.score} pts)` : `Score ${result.score}`;
  }
  return result.won ? 'Réussi' : 'Terminé';
}
