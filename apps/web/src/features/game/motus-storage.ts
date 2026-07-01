import type { MotusLevel } from '@pokegames/shared-types';

// Persistance locale du defi Motus quotidien (1 session par jour et par niveau). L'etat detaille vit en Redis.
function storageKey(level: MotusLevel): string {
  return `pokegames:motus:${level}`;
}

function doneKey(level: MotusLevel): string {
  return `pokegames:motus:${level}:done`;
}

export function motusTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MotusSaved {
  date: string;
  roundId: string;
  attemptsCount?: number;
}

export interface MotusDone {
  date: string;
  won: boolean;
  answer: string;
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

export function loadMotusSaved(level: MotusLevel): MotusSaved | null {
  const saved = readJson<MotusSaved>(storageKey(level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveMotus(level: MotusLevel, roundId: string, attemptsCount = 0): void {
  writeJson(storageKey(level), { date: motusTodayKey(), roundId, attemptsCount });
}

export function clearMotus(level: MotusLevel): void {
  try {
    localStorage.removeItem(storageKey(level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadMotusDone(level: MotusLevel): MotusDone | null {
  const done = readJson<MotusDone>(doneKey(level));
  if (done && typeof done.date === 'string' && typeof done.answer === 'string') {
    return done;
  }
  return null;
}

export function saveMotusDone(level: MotusLevel, won: boolean, answer: string): void {
  writeJson(doneKey(level), { date: motusTodayKey(), won, answer });
}

export type MotusDailyStatus = 'idle' | 'in-progress' | 'done';

export function motusDailyStatus(level: MotusLevel): MotusDailyStatus {
  const today = motusTodayKey();
  const done = loadMotusDone(level);
  if (done && done.date === today) return 'done';
  const saved = loadMotusSaved(level);
  if (saved && saved.date === today && (saved.attemptsCount ?? 0) >= 1) return 'in-progress';
  return 'idle';
}
