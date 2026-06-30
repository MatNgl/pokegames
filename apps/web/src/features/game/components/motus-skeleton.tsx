import { Card } from '@/components/ui/card';

const GRID_ROWS = 6;
const GRID_COLS = 5;
const KEYBOARD_ROWS = [10, 10, 7];

// Squelette affiche pendant le chargement du mot du jour : meme gabarit que le jeu, zero saut visuel.
export function MotusSkeleton() {
  return (
    <Card className="flex w-full max-w-xl flex-col items-center gap-5 p-6" aria-hidden="true">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="h-6 w-12 animate-pulse rounded-full bg-surface-2" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {Array.from({ length: GRID_ROWS }).map((_, r) => (
          <div key={r} className="flex gap-1.5">
            {Array.from({ length: GRID_COLS }).map((_, c) => (
              <div key={c} className="h-12 w-12 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ))}
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-1.5">
        {KEYBOARD_ROWS.map((count, r) => (
          <div key={r} className="flex w-full justify-center gap-1.5">
            {Array.from({ length: count }).map((_, k) => (
              <div key={k} className="h-11 w-7 animate-pulse rounded-md bg-surface-2 sm:w-9" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
