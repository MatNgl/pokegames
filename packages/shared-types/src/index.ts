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

export interface WhoIsItConfig {
  generations: number[]; // ex: [1, 2, 3] pour filtrer les générations
  timeLimitSeconds: number; // ex: 30
}

/**
 * Indice progressif révélé au joueur au cours de la manche.
 */
export interface WhoIsItHint {
  type: 'GENERATION' | 'TYPE_1' | 'TYPE_2' | 'FIRST_LETTER';
  label: string;
  value: string | number;
  revealedAtSecond: number; // seconde du timer où l'indice a été révélé
}

/**
 * Payload initial envoyé au client au démarrage du round.
 * ANTI-TRICHE : Aucune information permettant de deviner le Pokémon (ni nom, ni ID).
 * Le sprite est accessible UNIQUEMENT via `spriteProxyUrl`.
 */
export interface WhoIsItRoundState {
  roundId: string; // UUID unique pour cette manche
  sessionHash: string; // Hash temporaire pour charger le sprite masqué (/api/sprites/:sessionHash)
  spriteProxyUrl: string; // URL complète de proxy (ex: "/api/sprites/8f9d2a1c")
  status: 'PLAYING' | 'SOLVED' | 'TIMEOUT';
  startTime: number; // Timestamp du début du round
  timeLimitSeconds: number;
  hints: WhoIsItHint[]; // Indices déjà disponibles
}

/**
 * Requête envoyée par le client pour soumettre sa tentative.
 */
export interface WhoIsItGuessRequest {
  roundId: string;
  guess: string; // Tentative saisie par l'utilisateur (ex: "Pikachu")
}

/**
 * Réponse du serveur après une tentative ou l'expiration du chrono.
 */
export interface WhoIsItGuessResponse {
  success: boolean;
  isCorrect: boolean;
  status: 'PLAYING' | 'SOLVED' | 'TIMEOUT';
  message?: string;
  scoreEarned: number;
  /**
   * Une fois le round terminé (SOLVED ou TIMEOUT), le serveur révèle le Pokémon complet.
   */
  revealedPokemon: PokemonDTO | null;
  unmaskedSpriteUrl: string | null;
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

