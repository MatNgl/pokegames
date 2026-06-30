// Persistance locale du defi quotidien "Quel est ce Pokemon" (1 session par jour).
const STORAGE_KEY = 'pokegames:who-is-it';
const DONE_KEY = 'pokegames:who-is-it:done';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SavedGame {
  date: string;
  roundId: string;
  tried: string[];
  totalAttempts: number;
}

export interface DailyDone {
  date: string;
  totalAttempts: number;
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

export function loadSavedGame(): SavedGame | null {
  const saved = readJson<SavedGame>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return {
      date: saved.date,
      roundId: saved.roundId,
      tried: Array.isArray(saved.tried) ? saved.tried : [],
      totalAttempts: typeof saved.totalAttempts === 'number' ? saved.totalAttempts : 0,
    };
  }
  return null;
}

export function saveGame(game: SavedGame): void {
  writeJson(STORAGE_KEY, game);
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadDailyDone(): DailyDone | null {
  const done = readJson<DailyDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.totalAttempts === 'number') {
    return done;
  }
  return null;
}

export function saveDailyDone(done: DailyDone): void {
  writeJson(DONE_KEY, done);
}

export type WhoIsItDailyStatus = 'idle' | 'in-progress' | 'done';

export function whoIsItDailyStatus(): WhoIsItDailyStatus {
  const today = todayKey();
  const done = loadDailyDone();
  if (done && done.date === today) return 'done';
  const saved = loadSavedGame();
  if (saved && saved.date === today) return 'in-progress';
  return 'idle';
}
