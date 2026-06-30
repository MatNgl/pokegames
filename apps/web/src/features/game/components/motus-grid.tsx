import type { MotusLetterState, MotusRoundState } from '@pokegames/shared-types';
import { cn } from '@/lib/utils';

function stateClass(state: MotusLetterState): string {
  switch (state) {
    case 'CORRECT':
      return 'border-go-shadow bg-go text-white';
    case 'PRESENT':
      return 'border-[#b8860b] bg-accent text-foreground';
    case 'ABSENT':
    default:
      return 'border-[#1f1f1f] bg-[#3a3a3a] text-white';
  }
}

interface MotusGridProps {
  state: MotusRoundState;
  current: string;
  shakeKey: number;
}

const CELL = 'flex h-12 w-12 items-center justify-center rounded-md border-2 text-xl font-extrabold uppercase';

export function MotusGrid({ state, current, shakeKey }: MotusGridProps) {
  const rows = Array.from({ length: state.maxAttempts }, (_, r) => r);
  const cols = Array.from({ length: state.length }, (_, c) => c);
  const currentRow = state.attempts.length;
  const isPlaying = state.status === 'PLAYING';

  return (
    <div className="flex flex-col items-center gap-1.5">
      {rows.map((r) => {
        const attempt = state.attempts[r];
        const isCurrent = isPlaying && r === currentRow;
        return (
          <div
            key={isCurrent ? `current-${shakeKey}` : `row-${r}`}
            className={cn('flex gap-1.5', isCurrent && shakeKey > 0 && 'motus-shake')}
          >
            {cols.map((c) => {
              if (attempt) {
                const letter = attempt.letters[c];
                return (
                  <span key={c} className={cn(CELL, stateClass(letter?.state ?? 'ABSENT'))}>
                    {letter?.letter ?? ''}
                  </span>
                );
              }
              const char = isCurrent ? (current[c] ?? '') : '';
              return (
                <span
                  key={c}
                  className={cn(
                    CELL,
                    char
                      ? 'border-primary bg-white text-foreground'
                      : 'border-border-strong bg-white/70 text-foreground',
                  )}
                >
                  {char}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
