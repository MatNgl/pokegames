import type { WhoIsItLevel } from '@pokegames/shared-types';

// Persistance locale du defi quotidien "Quel est ce Pokemon" (1 session par jour et par niveau).
function storageKey(level: WhoIsItLevel): string {
  return `pokegames:who-is-it:${level}`;
}

function doneKey(level: WhoIsItLevel): string {
  return `pokegames:who-is-it:${level}:done`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SavedGame {
  date: string;
  roundId: string;
  tried: string[];
  totalAttempts: number;
  roundIndex?: number;
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

export function loadSavedGame(level: WhoIsItLevel): SavedGame | null {
  const saved = readJson<SavedGame>(storageKey(level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return {
      date: saved.date,
      roundId: saved.roundId,
      tried: Array.isArray(saved.tried) ? saved.tried : [],
      totalAttempts: typeof saved.totalAttempts === 'number' ? saved.totalAttempts : 0,
      roundIndex: typeof saved.roundIndex === 'number' ? saved.roundIndex : 1,
    };
  }
  return null;
}

export function saveGame(level: WhoIsItLevel, game: SavedGame): void {
  writeJson(storageKey(level), game);
}

export function clearSavedGame(level: WhoIsItLevel): void {
  try {
    localStorage.removeItem(storageKey(level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadDailyDone(level: WhoIsItLevel): DailyDone | null {
  const done = readJson<DailyDone>(doneKey(level));
  if (done && typeof done.date === 'string' && typeof done.totalAttempts === 'number') {
    return done;
  }
  return null;
}

export function saveDailyDone(level: WhoIsItLevel, done: DailyDone): void {
  writeJson(doneKey(level), done);
}

// Preference globale (pas liee au niveau ni au jour) : ne plus demander confirmation avant de passer.
const SKIP_NO_CONFIRM_KEY = 'pokegames:who-is-it:skip-no-confirm';

export function getSkipNoConfirm(): boolean {
  try {
    return localStorage.getItem(SKIP_NO_CONFIRM_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSkipNoConfirm(value: boolean): void {
  try {
    localStorage.setItem(SKIP_NO_CONFIRM_KEY, value ? 'true' : 'false');
  } catch {
    // Stockage indisponible : la confirmation sera simplement redemandee.
  }
}

export type WhoIsItDailyStatus = 'idle' | 'in-progress' | 'done';

export function whoIsItDailyStatus(level: WhoIsItLevel): WhoIsItDailyStatus {
  const today = todayKey();
  const done = loadDailyDone(level);
  if (done && done.date === today) return 'done';
  const saved = loadSavedGame(level);
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
