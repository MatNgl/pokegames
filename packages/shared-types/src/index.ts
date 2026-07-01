/**
 * @pokegames/shared-types
 * Contrat de données strict (Zéro any) entre l'API NestJS et le Frontend React.
 */

export interface PokemonTypeInfo {
  id: number;
  nameFr: string;
  nameEn: string;
  image: string;
}

export interface PokemonStats {
  hp: number;
  atk: number;
  def: number;
  speAtk: number;
  speDef: number;
  speed: number;
}

export interface PokemonEvolution {
  pokedexId: number;
  nameFr: string;
  condition: string | null;
}

/**
 * Entité Pokémon complète telle que stockée et renvoyée par le Pokédex public.
 */
export interface PokemonDTO {
  id: number;
  pokedexId: number;
  nameFr: string;
  nameEn: string;
  category: string | null;
  generation: number;
  spriteRegular: string;
  spriteShiny: string | null;
  stats: PokemonStats;
  weight: number | null;
  height: number | null;
  types: PokemonTypeInfo[];
  evolutions: PokemonEvolution[];
  evolvedFrom: PokemonEvolution[];
}

export type GameType =
  | 'WHO_IS_IT'
  | 'MOTUS'
  | 'PLUS_MINUS'
  | 'INTRUDER'
  | 'GUESS_WHO';

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/* ==========================================================================
 * JEU 1 : QUEL EST CE POKÉMON ? (WHO'S THAT POKÉMON)
 * ========================================================================== */

export type WhoIsItMode = 'CLASSIC' | 'DAILY';

export interface WhoIsItConfig {
  generations: number[];
  mode?: WhoIsItMode;
  roundsCount?: number; // par défaut 5 en classique
  roundIndex?: number; // manche courante dans la partie (1 à roundsCount)
  startCapital?: number; // par défaut 100
  wrongGuessPenalty?: number; // par défaut 15
  hintCost?: number; // par défaut 10
}

export type WhoIsItHintType =
  | 'GENERATION'
  | 'TYPE_1'
  | 'TYPE_2'
  | 'FIRST_LETTER'
  | 'BLURRED_COLOR'
  | 'COLOR_SHARPEN';

export interface WhoIsItHint {
  type: WhoIsItHintType;
  label: string;
  value: string | number;
  cost: number;
  unlockedAtMistakeCount: number; // Palier d'erreur pour débloquer
  isRevealed: boolean;
}

export interface WhoIsItRoundState {
  roundId: string;
  sessionHash: string;
  spriteProxyUrl: string;
  status: 'PLAYING' | 'SOLVED' | 'CANCELLED';
  startTime: number;
  currentScore: number;
  mistakesCount: number;
  mode: WhoIsItMode;
  roundIndex: number;
  totalRounds: number;
  hints: WhoIsItHint[];
  guestUsername?: string;
}

export interface WhoIsItGuessRequest {
  roundId: string;
  guess: string;
}

export interface WhoIsItHintRequest {
  roundId: string;
  hintType: WhoIsItHintType;
}

export interface WhoIsItGuessResponse {
  success: boolean;
  isCorrect: boolean;
  status: 'PLAYING' | 'SOLVED' | 'CANCELLED';
  message?: string;
  currentScore: number;
  mistakesCount: number;
  hints: WhoIsItHint[];
  revealedPokemon: PokemonDTO | null;
  unmaskedSpriteUrl: string | null;
  durationSeconds?: number;
  guestUsername?: string;
  canCreateAccountToSave?: boolean;
}

/* ==========================================================================
 * JEU 2 : POKÉ-MOTUS (WORDLE POKÉMON)
 * ========================================================================== */

export type MotusLetterState = 'CORRECT' | 'PRESENT' | 'ABSENT';

export interface MotusLetterResult {
  letter: string;
  state: MotusLetterState;
}

export interface MotusGuessRow {
  guess: string;
  letters: MotusLetterResult[];
}

export interface MotusRoundState {
  roundId: string;
  length: number;
  maxAttempts: number;
  attempts: MotusGuessRow[];
  status: 'PLAYING' | 'WON' | 'LOST';
  // Premiere lettre du mot, donnee des le depart (indice facon Motus). Majuscule A-Z.
  firstLetter: string;
  // Renseigne uniquement lorsque la partie est terminee (WON ou LOST).
  answer: string | null;
}

export interface MotusGuessRequest {
  roundId: string;
  guess: string;
}

export interface MotusGuessResponse {
  // false si la proposition n'est pas un Pokemon valide de la bonne longueur (rejetee, aucun essai consomme).
  accepted: boolean;
  message?: string;
  state: MotusRoundState;
}

/* ==========================================================================
 * JEU 3 : PLUS OU MOINS (DUEL DE CARACTÉRISTIQUES)
 * ========================================================================== */

export type PlusMinusCriterion = 'HP' | 'HEIGHT' | 'WEIGHT' | 'ATK' | 'DEF' | 'SPEED' | 'AGE';

export interface PlusMinusContestant {
  pokemonId: number;
  name: string;
  spriteUrl: string;
}

export interface PlusMinusRoundState {
  roundId: string;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  criterion: PlusMinusCriterion;
  criterionLabel: string; // question de la manche courante
  a: PlusMinusContestant; // valeurs jamais envoyees avant le choix
  b: PlusMinusContestant;
}

export interface PlusMinusChoiceRequest {
  roundId: string;
  choice: 'A' | 'B';
}

export interface PlusMinusReveal {
  pokemonId: number;
  value: number;
  displayValue: string; // valeur formatee (ex. "6.9 kg", "No 25")
}

export interface PlusMinusChoiceResponse {
  correct: boolean;
  correctChoice: 'A' | 'B';
  revealA: PlusMinusReveal;
  revealB: PlusMinusReveal;
  // Etat apres avancement : manche suivante si PLAYING, sinon partie terminee.
  state: PlusMinusRoundState;
}

/* ==========================================================================
 * JEU 4 : L'INTRUS (TROUVE CELUI QUI NE VA PAS)
 * ========================================================================== */

export type IntruderRule = 'GENERATION' | 'TYPE' | 'STAT' | 'EVOLUTION' | 'MEGA';

export interface IntruderMember {
  pokemonId: number;
  name: string;
  spriteUrl: string;
}

export interface IntruderRoundState {
  roundId: string;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  prompt: string; // consigne affichee ("Trouve l'intrus")
  members: IntruderMember[]; // 4 Pokemon melanges, la regle et l'intrus restent secrets
}

export interface IntruderMemberReveal {
  pokemonId: number;
  isIntruder: boolean;
  detail: string; // valeur affichee selon la regle (ex. "Vitesse 45", "Generation 1", "Feu")
  typeImage?: string; // regle TYPE : image du type partage
  megaSpriteUrl?: string; // regle MEGA : sprite de la mega-evolution
}

export interface IntruderChoiceRequest {
  roundId: string;
  pokemonId: number;
}

export interface IntruderChoiceResponse {
  correct: boolean;
  intruderId: number;
  rule: IntruderRule;
  commonLabel: string; // trait commun aux 3 autres (ex. "Meme type principal : Feu")
  reveals: IntruderMemberReveal[];
  // Etat apres avancement : manche suivante si PLAYING, sinon partie terminee.
  state: IntruderRoundState;
}

/* ==========================================================================
 * AUTHENTIFICATION & UTILISATEURS (AUTH / USERS)
 * ========================================================================== */

export interface UserDTO {
  id: string;
  email: string;
  username: string;
  role: string;
  eloScore: number;
  createdAt?: string | Date;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password?: string; // optionnel dans la réponse ou type partagé si utilisé pour payload
}

export interface LoginRequest {
  emailOrUsername: string;
  password?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDTO;
}

export interface PlayerHistoryItem {
  id: string;
  gameType: GameType;
  score: number;
  playedAt: string | Date;
  isMulti: boolean;
}

