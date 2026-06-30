// Persistance locale du defi Motus quotidien (1 session par jour). L'etat detaille vit en Redis cote serveur.
const STORAGE_KEY = 'pokegames:motus';
const DONE_KEY = 'pokegames:motus:done';

export function motusTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MotusSaved {
  date: string;
  roundId: string;
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

export function loadMotusSaved(): MotusSaved | null {
  const saved = readJson<MotusSaved>(STORAGE_KEY);
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveMotus(roundId: string): void {
  writeJson(STORAGE_KEY, { date: motusTodayKey(), roundId });
}

export function clearMotus(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadMotusDone(): MotusDone | null {
  const done = readJson<MotusDone>(DONE_KEY);
  if (done && typeof done.date === 'string' && typeof done.answer === 'string') {
    return done;
  }
  return null;
}

export function saveMotusDone(won: boolean, answer: string): void {
  writeJson(DONE_KEY, { date: motusTodayKey(), won, answer });
}

export type MotusDailyStatus = 'idle' | 'in-progress' | 'done';

export function motusDailyStatus(): MotusDailyStatus {
  const today = motusTodayKey();
  const done = loadMotusDone();
  if (done && done.date === today) return 'done';
  const saved = loadMotusSaved();
  if (saved && saved.date === today) return 'in-progress';
  return 'idle';
}
