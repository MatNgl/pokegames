import type { JustStatKey } from '@pokegames/shared-types';

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
