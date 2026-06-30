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

