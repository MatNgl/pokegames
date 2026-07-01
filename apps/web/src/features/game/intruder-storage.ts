import type { IntruderLevel } from '@pokegames/shared-types';

// Persistance locale du defi "L'Intrus" quotidien (1 session par jour et par niveau).
// L'etat detaille vit en Redis cote serveur.
function storageKey(level: IntruderLevel): string {
  return `pokegames:intruder:${level}`;
}

function doneKey(level: IntruderLevel): string {
  return `pokegames:intruder:${level}:done`;
}

export function intruderTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface IntruderSaved {
  date: string;
  roundId: string;
  roundIndex?: number;
}

export interface IntruderDone {
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

export function loadIntruderSaved(level: IntruderLevel): IntruderSaved | null {
  const saved = readJson<IntruderSaved>(storageKey(level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveIntruder(level: IntruderLevel, roundId: string, roundIndex = 1): void {
  writeJson(storageKey(level), { date: intruderTodayKey(), roundId, roundIndex });
}

export function clearIntruder(level: IntruderLevel): void {
  try {
    localStorage.removeItem(storageKey(level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadIntruderDone(level: IntruderLevel): IntruderDone | null {
  const done = readJson<IntruderDone>(doneKey(level));
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function saveIntruderDone(
  level: IntruderLevel,
  correctCount: number,
  totalRounds: number,
): void {
  writeJson(doneKey(level), { date: intruderTodayKey(), correctCount, totalRounds });
}

export type IntruderDailyStatus = 'idle' | 'in-progress' | 'done';

export function intruderDailyStatus(level: IntruderLevel): IntruderDailyStatus {
  const today = intruderTodayKey();
  const done = loadIntruderDone(level);
  if (done && done.date === today) return 'done';
  const saved = loadIntruderSaved(level);
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
