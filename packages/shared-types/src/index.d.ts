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
export type GameType = 'WHO_IS_IT' | 'MOTUS' | 'PLUS_MINUS' | 'INTRUDER' | 'GUESS_WHO';
export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type WhoIsItMode = 'CLASSIC' | 'DAILY';
export interface WhoIsItConfig {
    generations: number[];
    mode?: WhoIsItMode;
    roundsCount?: number;
    startCapital?: number;
    wrongGuessPenalty?: number;
    hintCost?: number;
}
export type WhoIsItHintType = 'GENERATION' | 'TYPE_1' | 'TYPE_2' | 'FIRST_LETTER' | 'BLURRED_COLOR';
export interface WhoIsItHint {
    type: WhoIsItHintType;
    label: string;
    value: string | number;
    cost: number;
    unlockedAtMistakeCount: number;
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
    password?: string;
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
