/** Fenetre d'analyse commune a tous les rapports admin. 0 = depuis le debut. */
export const ADMIN_PERIODS = [7, 30, 90, 0] as const;

export function parsePeriod(raw?: string): number {
  const n = Number(raw);
  return (ADMIN_PERIODS as readonly number[]).includes(n) ? n : 30;
}

/** Date de debut correspondant a la periode, ou null si « depuis le debut ». */
export function periodStart(days: number, now = new Date()): Date | null {
  if (days <= 0) return null;
  const start = new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
}

/** Filtre Prisma sur createdAt, vide si la periode couvre tout l'historique. */
export function createdAtFilter(days: number, now = new Date()): { createdAt?: { gte: Date } } {
  const start = periodStart(days, now);
  return start ? { createdAt: { gte: start } } : {};
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Liste continue de jours (AAAA-MM-JJ) : evite les trous dans les courbes. */
export function dayRange(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(dayKey(new Date(now.getTime() - i * 24 * 3600 * 1000)));
  }
  return out;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
