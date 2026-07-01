// Persistance locale du defi "Plus ou Moins" quotidien (1 session par jour). L'etat detaille vit en Redis.
const STORAGE_KEY = 'pokegames:plus-minus';
const DONE_KEY = 'pokegames:plus-minus:done';

export function plusMinusTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PlusMinusSaved {
  date: string;
  roundId: string;
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

export function loadPlusMinusSaved(): PlusMinusSaved | null {
  const saved = readJson<PlusMinusSaved>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function savePlusMinus(roundId: string): void {
  writeJson(STORAGE_KEY, { date: plusMinusTodayKey(), roundId });
}

export function clearPlusMinus(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadPlusMinusDone(): PlusMinusDone | null {
  const done = readJson<PlusMinusDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function savePlusMinusDone(correctCount: number, totalRounds: number): void {
  writeJson(DONE_KEY, { date: plusMinusTodayKey(), correctCount, totalRounds });
}

export type PlusMinusDailyStatus = 'idle' | 'in-progress' | 'done';

export function plusMinusDailyStatus(): PlusMinusDailyStatus {
  const today = plusMinusTodayKey();
  const done = loadPlusMinusDone();
  if (done && done.date === today) return 'done';
  const saved = loadPlusMinusSaved();
  if (saved && saved.date === today) return 'in-progress';
  return 'idle';
}
