// Persistance locale du defi "Le Pokedex" (1 session par jour). L'etat detaille vit en Redis.
const STORAGE_KEY = 'pokegames:pokedex-game';
const DONE_KEY = 'pokegames:pokedex-game:done';

export function pokedexGameTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PokedexGameSaved {
  date: string;
  roundId: string;
  attemptsUsed?: number;
}

export interface PokedexGameDone {
  date: string;
  won: boolean;
  attempts: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : on continue sans persistance.
  }
}

export function loadPokedexGameSaved(): PokedexGameSaved | null {
  const saved = readJson<PokedexGameSaved>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function savePokedexGame(roundId: string, attemptsUsed = 0): void {
  writeJson(STORAGE_KEY, { date: pokedexGameTodayKey(), roundId, attemptsUsed });
}

export function clearPokedexGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadPokedexGameDone(): PokedexGameDone | null {
  const done = readJson<PokedexGameDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.won === 'boolean') {
    return done;
  }
  return null;
}

export function savePokedexGameDone(won: boolean, attempts: number): void {
  writeJson(DONE_KEY, { date: pokedexGameTodayKey(), won, attempts });
}

export type PokedexGameDailyStatus = 'idle' | 'in-progress' | 'done';

export function pokedexGameDailyStatus(): PokedexGameDailyStatus {
  const today = pokedexGameTodayKey();
  const done = loadPokedexGameDone();
  if (done && done.date === today) return 'done';
  const saved = loadPokedexGameSaved();
  if (saved && saved.date === today && (saved.attemptsUsed ?? 0) > 0) return 'in-progress';
  return 'idle';
}
