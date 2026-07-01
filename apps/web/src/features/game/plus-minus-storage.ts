import type { PlusMinusLevel } from '@pokegames/shared-types';

// Persistance locale du defi "Plus ou Moins" quotidien (1 session par jour et par niveau).
// L'etat detaille vit en Redis cote serveur.
function storageKey(level: PlusMinusLevel): string {
  return `pokegames:plus-minus:${level}`;
}

function doneKey(level: PlusMinusLevel): string {
  return `pokegames:plus-minus:${level}:done`;
}

export function plusMinusTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PlusMinusSaved {
  date: string;
  roundId: string;
  roundIndex?: number;
}

export interface PlusMinusDone {
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

export function loadPlusMinusSaved(level: PlusMinusLevel): PlusMinusSaved | null {
  const saved = readJson<PlusMinusSaved>(storageKey(level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function savePlusMinus(level: PlusMinusLevel, roundId: string, roundIndex = 1): void {
  writeJson(storageKey(level), { date: plusMinusTodayKey(), roundId, roundIndex });
}

export function clearPlusMinus(level: PlusMinusLevel): void {
  try {
    localStorage.removeItem(storageKey(level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadPlusMinusDone(level: PlusMinusLevel): PlusMinusDone | null {
  const done = readJson<PlusMinusDone>(doneKey(level));
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function savePlusMinusDone(
  level: PlusMinusLevel,
  correctCount: number,
  totalRounds: number,
): void {
  writeJson(doneKey(level), { date: plusMinusTodayKey(), correctCount, totalRounds });
}

export type PlusMinusDailyStatus = 'idle' | 'in-progress' | 'done';

export function plusMinusDailyStatus(level: PlusMinusLevel): PlusMinusDailyStatus {
  const today = plusMinusTodayKey();
  const done = loadPlusMinusDone(level);
  if (done && done.date === today) return 'done';
  const saved = loadPlusMinusSaved(level);
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
