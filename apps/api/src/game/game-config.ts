import type { JustStatKey, TrueShinyLevel } from '@pokegames/shared-types';

/**
 * Parametres de configuration des jeux, centralises et types. Ce sont les valeurs qui seront
 * plus tard editables via /admin/games/*. Pour l'instant, source unique cote serveur.
 */

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

export interface TrueShinyLevelConfig {
  gridSize: number; // nombre de vignettes affichees
  hueMin: number; // amplitude minimale de rotation de teinte des leurres (degres)
  hueMax: number; // amplitude maximale
}

export interface TrueShinyConfig {
  roundsCount: number;
  levels: Record<TrueShinyLevel, TrueShinyLevelConfig>;
}

// Plus le niveau est dur, plus les leurres sont proches de l'original (rotation de teinte faible).
export const TRUE_SHINY_CONFIG: TrueShinyConfig = {
  roundsCount: 5,
  levels: {
    FACILE: { gridSize: 3, hueMin: 60, hueMax: 180 },
    MOYEN: { gridSize: 5, hueMin: 30, hueMax: 60 },
    DIFFICILE: { gridSize: 6, hueMin: 12, hueMax: 25 },
  },
};

export interface StatDescriptor {
  label: string;
  unit: string; // "" pour les stats brutes, "cm" ou "kg" pour taille et poids
  min: number; // borne indicative pour l'interface (jamais la vraie valeur)
  max: number;
}

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
