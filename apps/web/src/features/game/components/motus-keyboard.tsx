import type { MotusLetterState } from '@pokegames/shared-types';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROWS: string[][] = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N', 'DEL'],
];

function keyStateClass(state: MotusLetterState | undefined): string {
  switch (state) {
    case 'CORRECT':
      return 'border-go-shadow bg-go text-white';
    case 'PRESENT':
      return 'border-accent-shadow bg-accent text-foreground';
    case 'ABSENT':
      return 'border-absent-shadow bg-absent text-surface';
    default:
      return 'border-border-strong bg-surface text-foreground hover:bg-surface-2';
  }
}

interface MotusKeyboardProps {
  letterStates: Record<string, MotusLetterState>;
  disabled: boolean;
  onKey: (letter: string) => void;
  onBackspace: () => void;
}

const KEY_BASE =
  'flex h-11 items-center justify-center rounded-md border-2 px-1 text-sm font-bold uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-50 sm:px-2';

export function MotusKeyboard({ letterStates, disabled, onKey, onBackspace }: MotusKeyboardProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-1.5">
      {ROWS.map((row, index) => (
        <div key={index} className="flex w-full justify-center gap-1.5">
          {row.map((key) => {
            if (key === 'DEL') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={onBackspace}
                  aria-label="Effacer"
                  className={cn(
                    KEY_BASE,
                    'min-w-10 cursor-pointer border-border-strong bg-surface text-foreground hover:bg-surface-2',
                  )}
                >
                  <Delete className="h-4 w-4" />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onKey(key)}
                className={cn(KEY_BASE, 'min-w-7 cursor-pointer sm:min-w-9', keyStateClass(letterStates[key]))}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
