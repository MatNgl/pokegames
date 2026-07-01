// Persistance locale du defi "L'Intrus" quotidien (1 session par jour). L'etat detaille vit en Redis.
const STORAGE_KEY = 'pokegames:intruder';
const DONE_KEY = 'pokegames:intruder:done';

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

export function loadIntruderSaved(): IntruderSaved | null {
  const saved = readJson<IntruderSaved>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveIntruder(roundId: string, roundIndex = 1): void {
  writeJson(STORAGE_KEY, { date: intruderTodayKey(), roundId, roundIndex });
}

export function clearIntruder(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadIntruderDone(): IntruderDone | null {
  const done = readJson<IntruderDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function saveIntruderDone(correctCount: number, totalRounds: number): void {
  writeJson(DONE_KEY, { date: intruderTodayKey(), correctCount, totalRounds });
}

export type IntruderDailyStatus = 'idle' | 'in-progress' | 'done';

export function intruderDailyStatus(): IntruderDailyStatus {
  const today = intruderTodayKey();
  const done = loadIntruderDone();
  if (done && done.date === today) return 'done';
  const saved = loadIntruderSaved();
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
