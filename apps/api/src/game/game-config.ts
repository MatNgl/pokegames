import type {
  IntruderLevel,
  IntruderRule,
  JustStatKey,
  PlusMinusLevel,
  ShinyLevel,
  TrueShinyLevel,
  WhoIsItLevel,
  MotusLevel,
} from '@pokegames/shared-types';

/**
 * Parametres de configuration des jeux, centralises et types. Ce sont les valeurs qui seront
 * plus tard editables via /admin/games/*. Pour l'instant, source unique cote serveur.
 */

export interface WhoIsItLevelAdminConfig {
  allowedGenerations: number[];
  initialZoomRatio: number;
  zoomStepPerMistake: number;
  initialRotationAngle: number;
  rotationStepPerMistake: number;
}

export interface WhoIsItAdminConfig {
  roundsCount: number;
  startCapital: number;
  hintCosts: Record<string, number>;
  levels: Record<WhoIsItLevel, WhoIsItLevelAdminConfig>;
}

export const WHO_IS_IT_ADMIN_CONFIG: WhoIsItAdminConfig = {
  roundsCount: 5,
  startCapital: 100,
  hintCosts: {
    TYPE_1: 0,
    HEIGHT: 0,
    GENERATION: 0,
    BLURRED_COLOR: 0,
  },
  levels: {
    FACILE: { allowedGenerations: [1, 2, 3], initialZoomRatio: 1.0, zoomStepPerMistake: 0, initialRotationAngle: 0, rotationStepPerMistake: 0 },
    MOYEN: { allowedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9], initialZoomRatio: 2.0, zoomStepPerMistake: 0.2, initialRotationAngle: 0, rotationStepPerMistake: 0 },
    DIFFICILE: { allowedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9], initialZoomRatio: 2.6, zoomStepPerMistake: 0.24, initialRotationAngle: 30, rotationStepPerMistake: 8 },
    EXTREME: { allowedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9], initialZoomRatio: 3.0, zoomStepPerMistake: 0.3, initialRotationAngle: 70, rotationStepPerMistake: 15 },
  },
};

export interface MotusLevelAdminConfig {
  minWordLength: number;
  maxWordLength: number;
  maxAttempts: number;
  provideFirstLetter: boolean;
}

export interface MotusAdminConfig {
  levels: Record<MotusLevel, MotusLevelAdminConfig>;
}

export const MOTUS_ADMIN_CONFIG: MotusAdminConfig = {
  levels: {
    FACILE: { minWordLength: 5, maxWordLength: 6, maxAttempts: 6, provideFirstLetter: true },
    MOYEN: { minWordLength: 6, maxWordLength: 7, maxAttempts: 5, provideFirstLetter: true },
    DIFFICILE: { minWordLength: 5, maxWordLength: 8, maxAttempts: 6, provideFirstLetter: false },
    EXTREME: { minWordLength: 5, maxWordLength: 9, maxAttempts: 4, provideFirstLetter: false },
  },
};

export interface PlusMinusLevelConfig {
  // Bande d'ecart requise entre les deux valeurs du duel, exprimee en "points" (voir dimensionScale).
  minDiff: number;
  maxDiff: number;
  // Anciennete (numero de Pokedex) : ecart minimal dedie, car l'echelle (1..1025) n'a rien a voir
  // avec les stats. Un ecart de 25 dans le Pokedex serait trop proche (souvent meme generation).
  ageMinDiff: number;
}

export interface PlusMinusConfig {
  roundsCount: number;
  levels: Record<PlusMinusLevel, PlusMinusLevelConfig>;
}

// Ecart brut garanti entre les deux Pokemon d'un duel, par niveau (cf. regles du jeu).
// Facile : ecart large (facile a trancher). Extreme : valeurs tres proches.
export const PLUS_MINUS_CONFIG: PlusMinusConfig = {
  roundsCount: 10,
  levels: {
    FACILE: { minDiff: 45, maxDiff: 9999, ageMinDiff: 300 },
    MOYEN: { minDiff: 25, maxDiff: 45, ageMinDiff: 250 },
    DIFFICILE: { minDiff: 10, maxDiff: 25, ageMinDiff: 150 },
    EXTREME: { minDiff: 1, maxDiff: 9, ageMinDiff: 50 },
  },
};

export interface JustStatConfig {
  roundsCount: number;
  timeLimitSeconds: number;
  maxAttempts: number;
  allowedStats: JustStatKey[];
}

export const JUST_STAT_CONFIG: JustStatConfig = {
  roundsCount: 3,
  timeLimitSeconds: 20,
  maxAttempts: 15,
  allowedStats: ['HP', 'ATK', 'DEF', 'SPE_ATK', 'SPE_DEF', 'SPEED', 'HEIGHT_CM', 'WEIGHT_KG'],
};

// Mode d'indice pre-reponse par niveau : explicite (donne le critere), domaine (oriente sans
// donner la valeur), ou uniquement pour les criteres de stat (sinon aucun indice).
export type IntruderHintMode = 'EXPLICIT' | 'DOMAIN' | 'STAT_ONLY';

export interface IntruderLevelConfig {
  gridSize: number; // nombre de Pokemon affiches
  rules: IntruderRule[]; // criteres autorises a ce niveau
  hintMode: IntruderHintMode;
}

export interface IntruderConfig {
  roundsCount: number;
  levels: Record<IntruderLevel, IntruderLevelConfig>;
}

export const INTRUDER_CONFIG: IntruderConfig = {
  roundsCount: 5,
  levels: {
    FACILE: { gridSize: 4, rules: ['GENERATION', 'TYPE'], hintMode: 'EXPLICIT' },
    MOYEN: { gridSize: 5, rules: ['STAT', 'EVOLUTION'], hintMode: 'DOMAIN' },
    DIFFICILE: {
      gridSize: 6,
      rules: ['GENERATION', 'TYPE', 'STAT', 'EVOLUTION', 'MEGA'],
      hintMode: 'STAT_ONLY',
    },
  },
};

export interface ShinyLevelConfig {
  gridSize: number; // nombre de vignettes ; la difficulte vient du nombre de cartes
}

export interface ShinyConfig {
  roundsCount: number;
  levels: Record<ShinyLevel, ShinyLevelConfig>;
}

export const SHINY_CONFIG: ShinyConfig = {
  roundsCount: 5,
  levels: {
    FACILE: { gridSize: 3 },
    MOYEN: { gridSize: 4 },
    DIFFICILE: { gridSize: 6 },
  },
};

export interface TrueShinyLevelConfig {
  gridSize: number; // nombre de vignettes affichees
  hueMin: number; // amplitude minimale de rotation de teinte des leurres (degres)
  hueMax: number; // amplitude maximale
}

export interface TrueShinyConfig {
  roundsCount: number;
  levels: Record<TrueShinyLevel, TrueShinyLevelConfig>;
}

export const TRUE_SHINY_CONFIG: TrueShinyConfig = {
  roundsCount: 5,
  levels: {
    FACILE: { gridSize: 3, hueMin: 60, hueMax: 180 },
    MOYEN: { gridSize: 5, hueMin: 60, hueMax: 180 },
    DIFFICILE: { gridSize: 6, hueMin: 60, hueMax: 180 },
  },
};

export interface StatDescriptor {
  label: string;
  unit: string; // "" pour les stats brutes, "cm" ou "kg" pour taille et poids
  min: number; // borne indicative pour l'interface (jamais la vraie valeur)
  max: number;
}

/**
 * Anti-repetition cross-jours : nombre de jours pendant lesquels un Pokemon deja tire n'est plus
 * repropose dans un jeu. Calcule d'apres pool / tires-par-jour (facteur ~0,4, plafond 30 jours) pour
 * rester equitable sans geler le dex. Voir HistoryService (recentPokemonIds + recordPicks).
 */
export const ANTI_REPEAT_WINDOW_DAYS = {
  PLUS_MINUS: 5,
  INTRUDER: 6,
  SHINY: 6, // par mode
  WHO_IS_IT: 20,
  TRUE_SHINY: 30,
  JUST_STAT: 30,
  MOTUS: 30,
} as const;

// Dimensions secondaires (stat, critere) : rarefiees sur une fenetre courte.
export const ANTI_REPEAT_DETAIL_WINDOW_DAYS = 1;

export const JUST_STAT_DESCRIPTORS: Record<JustStatKey, StatDescriptor> = {
  HP: { label: 'PV', unit: '', min: 1, max: 255 },
  ATK: { label: 'Attaque', unit: '', min: 1, max: 255 },
  DEF: { label: 'Défense', unit: '', min: 1, max: 255 },
  SPE_ATK: { label: 'Attaque Spéciale', unit: '', min: 1, max: 255 },
  SPE_DEF: { label: 'Défense Spéciale', unit: '', min: 1, max: 255 },
  SPEED: { label: 'Vitesse', unit: '', min: 1, max: 255 },
  HEIGHT_CM: { label: 'Taille', unit: 'cm', min: 10, max: 2000 },
  WEIGHT_KG: { label: 'Poids', unit: 'kg', min: 0, max: 1000 },
};
