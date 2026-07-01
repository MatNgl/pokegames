import type { DailyResultDTO } from '@pokegames/shared-types';

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

export function gameLabel(gameType: string): string {
  return GAME_LABELS[gameType] ?? gameType;
}

/** Formate le scope (niveau et/ou mode) d'un defi en libelle lisible. */
export function scopeLabel(scope: string): string {
  if (!scope) return '';
  if (scope.includes(':')) {
    const [mode, level] = scope.split(':');
    const modeLabel = mode ? (MODE_LABELS[mode] ?? mode) : '';
    const lvlLabel = level ? (LEVEL_LABELS[level] ?? level) : '';
    return [modeLabel, lvlLabel].filter(Boolean).join(' · ');
  }
  return LEVEL_LABELS[scope] ?? scope;
}

/** Metrique d'affichage selon le jeu (essais, score, bonnes reponses). */
export function resultMetric(result: DailyResultDTO): string {
  if (result.attempts != null) {
    return result.won ? `Gagné en ${result.attempts} essai${result.attempts > 1 ? 's' : ''}` : 'Perdu';
  }
  if (result.correctCount != null && result.totalRounds != null) {
    return `${result.correctCount}/${result.totalRounds} bonnes réponses`;
  }
  if (result.score != null) {
    return result.won ? `Réussi (${result.score} pts)` : `Score ${result.score}`;
  }
  return result.won ? 'Réussi' : 'Terminé';
}
