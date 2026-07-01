import type { ShinyLevel, ShinyMode } from '@pokegames/shared-types';

// Persistance locale des defis "Trouve le shiny" quotidiens (1 session par jour, par mode et par niveau).
// L'etat detaille vit en Redis. Les cles sont suffixees par le mode et le niveau pour separer les defis.
function storageKey(mode: ShinyMode, level: ShinyLevel): string {
  return `pokegames:shiny:${mode}:${level}`;
}

function doneKey(mode: ShinyMode, level: ShinyLevel): string {
  return `pokegames:shiny:${mode}:${level}:done`;
}

export function shinyTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ShinySaved {
  date: string;
  roundId: string;
  roundIndex?: number;
}

export interface ShinyDone {
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

export function loadShinySaved(mode: ShinyMode, level: ShinyLevel): ShinySaved | null {
  const saved = readJson<ShinySaved>(storageKey(mode, level));
  if (saved && typeof saved.roundId === 'string' && typeof saved.date === 'string') {
    return saved;
  }
  return null;
}

export function saveShiny(
  mode: ShinyMode,
  level: ShinyLevel,
  roundId: string,
  roundIndex = 1,
): void {
  writeJson(storageKey(mode, level), { date: shinyTodayKey(), roundId, roundIndex });
}

export function clearShiny(mode: ShinyMode, level: ShinyLevel): void {
  try {
    localStorage.removeItem(storageKey(mode, level));
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function loadShinyDone(mode: ShinyMode, level: ShinyLevel): ShinyDone | null {
  const done = readJson<ShinyDone>(doneKey(mode, level));
  if (done && typeof done.date === 'string' && typeof done.correctCount === 'number') {
    return done;
  }
  return null;
}

export function saveShinyDone(
  mode: ShinyMode,
  level: ShinyLevel,
  correctCount: number,
  totalRounds: number,
): void {
  writeJson(doneKey(mode, level), { date: shinyTodayKey(), correctCount, totalRounds });
}

export type ShinyDailyStatus = 'idle' | 'in-progress' | 'done';

export function shinyDailyStatus(mode: ShinyMode, level: ShinyLevel): ShinyDailyStatus {
  const today = shinyTodayKey();
  const done = loadShinyDone(mode, level);
  if (done && done.date === today) return 'done';
  const saved = loadShinySaved(mode, level);
  if (saved && saved.date === today && (saved.roundIndex ?? 1) > 1) return 'in-progress';
  return 'idle';
}
