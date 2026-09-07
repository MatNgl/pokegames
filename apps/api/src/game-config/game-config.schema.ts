import { z } from 'zod';

/**
 * Bornes de la configuration des jeux. Sans elles, l'editeur admin accepte n'importe quoi :
 * `roundsCount: -5` ou `gridSize: "trois"` partent en base et cassent le jeu en production, sans
 * message d'erreur, pour tous les joueurs. Chaque champ a donc une borne explicite, choisie pour
 * rester jouable (une grille de 2 cartes ou un chrono de 2 secondes ne sont pas des reglages).
 *
 * `.strict()` partout : une cle inconnue est refusee plutot que persistee silencieusement.
 */

/** Entier borne, avec un message francais lisible dans l'interface admin. */
function int(min: number, max: number) {
  return z
    .number({ message: 'doit être un nombre entier' })
    .int('doit être un nombre entier')
    .min(min, `doit être au minimum ${min}`)
    .max(max, `doit être au maximum ${max}`);
}

/** Decimal borne (ratios de zoom, pas de dezoom). */
function num(min: number, max: number) {
  return z
    .number({ message: 'doit être un nombre' })
    .min(min, `doit être au minimum ${min}`)
    .max(max, `doit être au maximum ${max}`);
}

function nonEmpty<T extends z.ZodTypeAny>(item: T) {
  return z.array(item).min(1, 'il faut au moins une valeur');
}

const GENERATION = int(1, 9);
const ROUNDS = int(1, 20);

/* ------------------------------------------------------------- Silhouette */

const whoIsItLevel = z
  .object({
    allowedGenerations: nonEmpty(GENERATION),
    initialZoomRatio: num(1, 8),
    zoomStepPerMistake: num(0, 4),
    initialRotationAngle: num(0, 180),
    rotationStepPerMistake: num(0, 90),
  })
  .strict();

const whoIsIt = z
  .object({
    roundsCount: ROUNDS,
    startCapital: int(0, 10000),
    hintCosts: z.record(z.string(), int(0, 500)),
    hintUnlocks: z.record(z.string(), int(1, 20)),
    levels: z
      .object({
        FACILE: whoIsItLevel,
        MOYEN: whoIsItLevel,
        DIFFICILE: whoIsItLevel,
        EXTREME: whoIsItLevel,
      })
      .strict(),
  })
  .strict();

/* ------------------------------------------------------------- Poké-Motus */

const motusLevel = z
  .object({
    minWordLength: int(3, 14),
    maxWordLength: int(3, 14),
    maxAttempts: int(1, 12),
    provideFirstLetter: z.boolean(),
  })
  .strict()
  .refine((l) => l.minWordLength <= l.maxWordLength, {
    message: 'la longueur minimale doit être inférieure ou égale à la maximale',
    path: ['minWordLength'],
  });

const motus = z
  .object({
    levels: z
      .object({
        FACILE: motusLevel,
        MOYEN: motusLevel,
        DIFFICILE: motusLevel,
        EXTREME: motusLevel,
      })
      .strict(),
  })
  .strict();

/* ----------------------------------------------------------- Plus ou Moins */

const PLUS_MINUS_CRITERIA = ['HP', 'HEIGHT', 'WEIGHT', 'ATK', 'DEF', 'SPEED', 'AGE'] as const;

const plusMinusLevel = z
  .object({
    minDiff: int(0, 10000),
    maxDiff: int(0, 10000),
    ageMinDiff: int(1, 1025),
  })
  .strict()
  .refine((l) => l.minDiff <= l.maxDiff, {
    message: "l'écart minimal doit être inférieur ou égal à l'écart maximal",
    path: ['minDiff'],
  });

const plusMinus = z
  .object({
    roundsCount: int(1, 30),
    enabledStats: nonEmpty(z.enum(PLUS_MINUS_CRITERIA)),
    levels: z
      .object({
        FACILE: plusMinusLevel,
        MOYEN: plusMinusLevel,
        DIFFICILE: plusMinusLevel,
        EXTREME: plusMinusLevel,
      })
      .strict(),
  })
  .strict();

/* ----------------------------------------------------------------- Intrus */

const INTRUDER_RULES = ['GENERATION', 'TYPE', 'STAT', 'EVOLUTION', 'MEGA'] as const;

const intruderLevel = z
  .object({
    // Moins de 3 cases : l'intrus se devine au hasard une fois sur deux.
    gridSize: int(3, 12),
    rules: nonEmpty(z.enum(INTRUDER_RULES)),
    hintMode: z.enum(['EXPLICIT', 'DOMAIN', 'STAT_ONLY']),
  })
  .strict();

const intruder = z
  .object({
    roundsCount: ROUNDS,
    statThresholds: nonEmpty(int(1, 255)),
    levels: z
      .object({ FACILE: intruderLevel, MOYEN: intruderLevel, DIFFICILE: intruderLevel })
      .strict(),
  })
  .strict();

/* ------------------------------------------------------------------ Shiny */

const shinyLevel = z.object({ gridSize: int(2, 12) }).strict();

const shiny = z
  .object({
    roundsCount: ROUNDS,
    levels: z.object({ FACILE: shinyLevel, MOYEN: shinyLevel, DIFFICILE: shinyLevel }).strict(),
  })
  .strict();

/* ------------------------------------------------------------- Bon Shiny */

const trueShinyLevel = z
  .object({
    gridSize: int(2, 12),
    // Sous 20 degres de rotation de teinte, la difference n'est plus visible a l'oeil.
    hueMin: int(20, 340),
    hueMax: int(20, 340),
  })
  .strict()
  .refine((l) => l.hueMin <= l.hueMax, {
    message: 'la teinte minimale doit être inférieure ou égale à la maximale',
    path: ['hueMin'],
  });

const trueShiny = z
  .object({
    roundsCount: ROUNDS,
    levels: z
      .object({ FACILE: trueShinyLevel, MOYEN: trueShinyLevel, DIFFICILE: trueShinyLevel })
      .strict(),
  })
  .strict();

/* -------------------------------------------------------------- Juste Stat */

const JUST_STAT_KEYS = [
  'HP',
  'ATK',
  'DEF',
  'SPE_ATK',
  'SPE_DEF',
  'SPEED',
  'HEIGHT_CM',
  'WEIGHT_KG',
] as const;

const justStat = z
  .object({
    roundsCount: int(1, 10),
    timeLimitSeconds: int(5, 300),
    maxAttempts: int(1, 50),
    allowedStats: nonEmpty(z.enum(JUST_STAT_KEYS)),
  })
  .strict();

/* -------------------------------------------------------------- Qui est-ce */

const guessWho = z
  .object({
    // La grille doit rester assez large pour que la deduction ait un interet.
    gridSize: int(9, 48),
    phaseSeconds: z
      .object({ ASKING: int(5, 300), ANSWERING: int(5, 300), ELIMINATING: int(5, 300) })
      .strict(),
  })
  .strict();

/* --------------------------------------------------------- Anti-repetition */

const antiRepeat = z
  .object({
    windows: z.record(z.string(), int(0, 365)),
    detailWindow: int(0, 365),
  })
  .strict();


/* ------------------------------------------------------------- Le Pokedex */

const pokedexGame = z
  .object({
    // Sous 3 essais le jeu est infaisable, au-dela de 15 il n'a plus d'enjeu.
    maxAttempts: int(3, 15),
    // Tolerance du verdict "partiel" : un ecart relatif seul est trop severe sur les petites
    // valeurs, d'ou le plancher absolu qui l'accompagne.
    heightTolerancePct: int(0, 100),
    heightToleranceMinM: num(0, 10),
    weightTolerancePct: int(0, 100),
    weightToleranceMinKg: num(0, 100),
  })
  .strict();

export const CONFIG_SCHEMAS = {
  WHO_IS_IT: whoIsIt,
  MOTUS: motus,
  PLUS_MINUS: plusMinus,
  INTRUDER: intruder,
  SHINY: shiny,
  TRUE_SHINY: trueShiny,
  JUST_STAT: justStat,
  GUESS_WHO: guessWho,
  POKEDEX: pokedexGame,
  ANTI_REPEAT: antiRepeat,
} as const;

export type ConfigSchemaKey = keyof typeof CONFIG_SCHEMAS;

/**
 * Traduit les erreurs zod en une phrase lisible dans l'admin : "levels.FACILE.gridSize : doit être
 * au minimum 3". Sans le chemin, l'admin ne sait pas quel champ corriger dans un objet imbrique.
 */
export function formatIssues(issues: z.core.$ZodIssue[]): string {
  const lines = issues.slice(0, 4).map((i) => {
    const path = i.path.join('.');
    const message = i.code === 'unrecognized_keys' ? 'champ inconnu' : i.message;
    return path ? `${path} : ${message}` : message;
  });
  const extra = issues.length > lines.length ? ` (et ${issues.length - lines.length} autre(s))` : '';
  return `${lines.join(' ; ')}${extra}`;
}
