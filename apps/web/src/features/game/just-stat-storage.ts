// Persistance locale du defi "La Juste Stat" quotidien (1 session par jour). L'etat detaille vit en Redis.
const STORAGE_KEY = 'pokegames:just-stat';
const DONE_KEY = 'pokegames:just-stat:done';

export function justStatTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface JustStatSaved {
  date: string;
  roundId: string;
  roundIndex?: number;
}

export interface JustStatDone {
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

export function loadJustStatSaved(): JustStatSaved | null {
  const saved = readJson<JustStatSaved>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveJustStat(roundId: string, roundIndex = 1): void {
  writeJson(STORAGE_KEY, { date: justStatTodayKey(), roundId, roundIndex });
}

export function clearJustStat(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadJustStatDone(): JustStatDone | null {
  const done = readJson<JustStatDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function saveJustStatDone(correctCount: number, totalRounds: number): void {
  writeJson(DONE_KEY, { date: justStatTodayKey(), correctCount, totalRounds });
}

export type JustStatDailyStatus = 'idle' | 'in-progress' | 'done';

export function justStatDailyStatus(): JustStatDailyStatus {
  const today = justStatTodayKey();
  const done = loadJustStatDone();
  if (done && done.date === today) return 'done';
  const saved = loadJustStatSaved();
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
