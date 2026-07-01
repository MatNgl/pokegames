import type { TrueShinyLevel } from '@pokegames/shared-types';

// Persistance locale des defis "Le Bon Shiny" quotidiens (1 session par jour et par niveau).
function storageKey(level: TrueShinyLevel): string {
  return `pokegames:true-shiny:${level}`;
}

function doneKey(level: TrueShinyLevel): string {
  return `pokegames:true-shiny:${level}:done`;
}

export function trueShinyTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TrueShinySaved {
  date: string;
  roundId: string;
}

export interface TrueShinyDone {
  date: string;
  correctCount: number;
  totalRounds: number;
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

export function loadTrueShinySaved(level: TrueShinyLevel): TrueShinySaved | null {
  const saved = readJson<TrueShinySaved>(storageKey(level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveTrueShiny(level: TrueShinyLevel, roundId: string): void {
  writeJson(storageKey(level), { date: trueShinyTodayKey(), roundId });
}

export function clearTrueShiny(level: TrueShinyLevel): void {
  try {
    localStorage.removeItem(storageKey(level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadTrueShinyDone(level: TrueShinyLevel): TrueShinyDone | null {
  const done = readJson<TrueShinyDone>(doneKey(level));
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function saveTrueShinyDone(
  level: TrueShinyLevel,
  correctCount: number,
  totalRounds: number,
): void {
  writeJson(doneKey(level), { date: trueShinyTodayKey(), correctCount, totalRounds });
}

export type TrueShinyDailyStatus = 'idle' | 'in-progress' | 'done';

export function trueShinyDailyStatus(level: TrueShinyLevel): TrueShinyDailyStatus {
  const today = trueShinyTodayKey();
  const done = loadTrueShinyDone(level);
  if (done && done.date === today) return 'done';
  const saved = loadTrueShinySaved(level);
  if (saved && saved.date === today) return 'in-progress';
  return 'idle';
}
