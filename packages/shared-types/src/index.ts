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

/* Resultats quotidiens (joueurs connectes) : verrou serveur, historique, classements. */
export interface DailyResultDTO {
  gameType: string;
  scope: string; // niveau et/ou mode ("FACILE", "FIND_SHINY:MOYEN", ...)
  dayDate: string; // AAAA-MM-JJ (UTC)
  won: boolean;
  attempts: number | null;
  score: number | null;
  correctCount: number | null;
  totalRounds: number | null;
  durationSeconds: number | null;
}

export interface DailyStatusResponse {
  authenticated: boolean;
  results: DailyResultDTO[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  isMe: boolean;
  won: boolean;
  attempts: number | null;
  score: number | null;
  correctCount: number | null;
  totalRounds: number | null;
  durationSeconds: number | null;
}

export interface LeaderboardResponse {
  gameType: string;
  scope: string;
  entries: LeaderboardEntry[];
}

/* ==========================================================================
 * Admin (dashboard, gestion utilisateurs, configuration dynamique)
 * ========================================================================== */

export interface AdminStats {
  totalUsers: number;
  totalGames: number;
  successfulGames: number;
  successRatePct: number;
}

export interface AdminAuditLogEntry {
  id: string;
  gameType: string;
  userId: string | null;
  targetNameFr: string;
  userGuess: string | null;
  isSuccess: boolean;
  scoreEarned: number;
  durationSeconds: number;
  hintsUsedCount: number;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  gamesPlayed: number;
  totalTimeSeconds: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  dailyResultsCount: number;
  recentGames: AdminAuditLogEntry[];
}

export interface AdminGameConfigEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number; // 1-indexe
  pageSize: number;
}

/* ==========================================================================
 * Qui est-ce ? (multijoueur 1v1, temps reel Socket.io)
 * ========================================================================== */

export interface GuessWhoCard {
  pokemonId: number;
  name: string;
}

export type GuessWhoPhase = 'ASKING' | 'ANSWERING' | 'ELIMINATING';

export interface GuessWhoStateDTO {
  gameId: string;
  grid: GuessWhoCard[]; // grille commune de 25 Pokemon
  yourSecretPokemonId: number; // le Pokemon secret du joueur (jamais celui de l'adversaire)
  opponentName: string;
  phase: GuessWhoPhase;
  yourTurn: boolean; // true si c'est a vous de poser la question / d'eliminer
  currentQuestion: string | null;
  turnDeadline: number | null; // epoch ms : fin du minuteur d'elimination
}

export interface GuessWhoOverDTO {
  youWon: boolean;
  winnerName: string;
  yourSecretPokemonId: number;
  opponentSecretPokemonId: number;
  reason: 'GUESS' | 'FORFEIT';
}

// Canaux Socket.io (client -> serveur et serveur -> client).
export const GUESS_WHO_EVENTS = {
  // client -> serveur
  joinQueue: 'gw:joinQueue',
  createRoom: 'gw:createRoom',
  joinRoom: 'gw:joinRoom',
  cancel: 'gw:cancel',
  ask: 'gw:ask',
  answer: 'gw:answer',
  endTurn: 'gw:endTurn', // clore la phase d'elimination en avance
  finalGuess: 'gw:finalGuess',
  forfeit: 'gw:forfeit', // abandon volontaire en cours de partie (l'adversaire gagne)
  // serveur -> client
  waiting: 'gw:waiting', // { code? } en attente d'un adversaire
  roomCreated: 'gw:roomCreated', // { code }
  state: 'gw:state', // GuessWhoStateDTO
  question: 'gw:question', // { text }
  answered: 'gw:answered', // { value: boolean }
  over: 'gw:over', // GuessWhoOverDTO
  errorMsg: 'gw:error', // { message }
  opponentLeft: 'gw:opponentLeft', // { untilTs } adversaire deconnecte, forfait a untilTs si pas de retour
  opponentBack: 'gw:opponentBack', // {} adversaire reconnecte
} as const;

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
  | 'SHINY'
  | 'TRUE_SHINY'
  | 'JUST_STAT'
  | 'GUESS_WHO';

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/* ==========================================================================
 * JEU 1 : QUEL EST CE POKÉMON ? (WHO'S THAT POKÉMON)
 * ========================================================================== */

export type WhoIsItLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'EXTREME';
export type WhoIsItMode = 'CLASSIC' | 'DAILY';

export interface WhoIsItConfig {
  generations: number[];
  mode?: WhoIsItMode;
  level?: WhoIsItLevel;
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
  | 'COLOR_SHARPEN'
  | 'HEIGHT';

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
  level?: WhoIsItLevel;
  zoomRatio?: number;
  rotationAngle?: number;
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
  level?: WhoIsItLevel;
  zoomRatio?: number;
  rotationAngle?: number;
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

export type MotusLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'EXTREME';
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
  level?: MotusLevel;
  length: number;
  maxAttempts: number;
  attempts: MotusGuessRow[];
  status: 'PLAYING' | 'WON' | 'LOST';
  // Premiere lettre du mot si fournie par le niveau (Facile, Moyen), null sinon.
  firstLetter: string | null;
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

export type PlusMinusLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'EXTREME';

export interface PlusMinusContestant {
  pokemonId: number;
  name: string;
  spriteUrl: string;
}

export interface PlusMinusStartRequest {
  level: PlusMinusLevel;
}

export interface PlusMinusRoundState {
  roundId: string;
  level: PlusMinusLevel;
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

export type IntruderLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export interface IntruderMember {
  pokemonId: number;
  name: string;
  spriteUrl: string;
}

export interface IntruderStartRequest {
  level: IntruderLevel;
}

export interface IntruderRoundState {
  roundId: string;
  level: IntruderLevel;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  prompt: string; // consigne affichee ("Trouve l'intrus")
  // Indice pre-reponse selon le niveau (explicite en Facile, domaine en Moyen, null si non fourni).
  hint: string | null;
  members: IntruderMember[]; // gridSize Pokemon melanges, la regle et l'intrus restent secrets
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
 * JEU 5 : TROUVE LE SHINY (REPERE LA CHROMATIQUE)
 * ========================================================================== */

// FIND_SHINY : 2 Pokemon normaux + 1 shiny, trouver le shiny.
// FIND_NON_SHINY : 2 Pokemon shiny + 1 normal, trouver celui qui n'est pas shiny.
export type ShinyMode = 'FIND_SHINY' | 'FIND_NON_SHINY';

export type ShinyLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export interface ShinyTile {
  slot: number; // 0 a gridSize-1
  imageUrl: string; // proxy opaque : ne revele jamais si la vignette est shiny
}

export interface ShinyStartRequest {
  mode: ShinyMode;
  level: ShinyLevel;
}

export interface ShinyRoundState {
  roundId: string;
  mode: ShinyMode;
  level: ShinyLevel;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  prompt: string; // consigne selon le mode
  tiles: ShinyTile[]; // gridSize Pokemon differents, l'intrus chromatique reste secret
}

export interface ShinyTileReveal {
  slot: number;
  pokemonId: number;
  name: string;
  isShiny: boolean;
  isAnswer: boolean; // vignette a trouver (le shiny en normal, le normal en reverse)
}

export interface ShinyChoiceRequest {
  roundId: string;
  slot: number;
}

export interface ShinyChoiceResponse {
  correct: boolean;
  answerSlot: number;
  reveals: ShinyTileReveal[];
  // Etat apres avancement : manche suivante si PLAYING, sinon partie terminee.
  state: ShinyRoundState;
}

/* ==========================================================================
 * JEU 6 : TROUVE LE BON SHINY (SPRITE CHROMATIQUE INTACT)
 * ========================================================================== */

export type TrueShinyLevel = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export interface TrueShinyTile {
  slot: number; // 0 a gridSize-1
  imageUrl: string; // proxy opaque : image deja alteree (ou non) par le serveur, jamais en CSS
}

export interface TrueShinyRoundState {
  roundId: string;
  level: TrueShinyLevel;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  // Toutes les vignettes montrent le meme Pokemon shiny ; une seule est intacte, a trouver.
  tiles: TrueShinyTile[];
}

export interface TrueShinyTileReveal {
  slot: number;
  isAnswer: boolean; // vignette intacte a trouver
}

export interface TrueShinyChoiceRequest {
  roundId: string;
  slot: number;
}

export interface TrueShinyChoiceResponse {
  correct: boolean;
  answerSlot: number;
  pokemonName: string; // revele a la fin de la manche
  reveals: TrueShinyTileReveal[];
  state: TrueShinyRoundState;
}

/* ==========================================================================
 * JEU 7 : LA JUSTE STAT (FACON LE JUSTE PRIX)
 * ========================================================================== */

export type JustStatKey =
  | 'HP'
  | 'ATK'
  | 'DEF'
  | 'SPE_ATK'
  | 'SPE_DEF'
  | 'SPEED'
  | 'HEIGHT_CM'
  | 'WEIGHT_KG';

export type JustStatDirection = 'HIGHER' | 'LOWER' | 'CORRECT';

export interface JustStatPokemon {
  id: number;
  name: string;
  spriteUrl: string;
}

export interface JustStatRoundState {
  roundId: string;
  totalRounds: number;
  roundIndex: number; // manche courante (1 a totalRounds)
  correctCount: number;
  status: 'PLAYING' | 'FINISHED';
  pokemon: JustStatPokemon;
  stat: JustStatKey;
  statLabel: string; // libelle affiche (ex. "Vitesse")
  statUnit: string; // unite affichee ("", "cm", "kg")
  min: number; // borne basse indicative pour l'interface (ne revele pas la reponse)
  max: number; // borne haute indicative
  timeLimitSeconds: number;
  maxAttempts: number;
  attemptsRemaining: number;
}

export interface JustStatGuessRequest {
  roundId: string;
  guessValue: number;
}

// Reponse a une proposition (guess) ou a un temps ecoule (timeout, direction null).
export interface JustStatGuessResponse {
  direction: JustStatDirection | null;
  attemptsRemaining: number;
  roundOver: boolean; // vrai si la manche est terminee (trouvee, plus d'essais, ou temps ecoule)
  correctValue: number | null; // revele uniquement quand roundOver est vrai
  state: JustStatRoundState; // manche courante si !roundOver, sinon suivante ou partie terminee
}

export interface JustStatTimeoutRequest {
  roundId: string;
}

/* ==========================================================================
 * AUTHENTIFICATION & UTILISATEURS (AUTH / USERS)
 * ========================================================================== */

export interface UserDTO {
  id: string;
  email: string;
  username: string;
  role: string;
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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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

