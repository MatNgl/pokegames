import type { MotusLetterState } from '@pokegames/shared-types';
import { CornerDownLeft, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROWS: string[][] = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'DEL'],
];

function keyStateClass(state: MotusLetterState | undefined): string {
  switch (state) {
    case 'CORRECT':
      return 'border-go-shadow bg-go text-white';
    case 'PRESENT':
      return 'border-[#b8860b] bg-accent text-foreground';
    case 'ABSENT':
      return 'border-[#1f1f1f] bg-[#3a3a3a] text-white';
    default:
      return 'border-border-strong bg-surface text-foreground hover:bg-surface-2';
  }
}

interface MotusKeyboardProps {
  letterStates: Record<string, MotusLetterState>;
  disabled: boolean;
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

const KEY_BASE =
  'flex h-11 items-center justify-center rounded-md border-2 px-2 text-sm font-bold uppercase transition-colors duration-150 disabled:opacity-50';

export function MotusKeyboard({
  letterStates,
  disabled,
  onKey,
  onEnter,
  onBackspace,
}: MotusKeyboardProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {ROWS.map((row, index) => (
        <div key={index} className="flex gap-1.5">
          {row.map((key) => {
            if (key === 'ENTER') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={onEnter}
                  aria-label="Valider"
                  className={cn(KEY_BASE, 'cursor-pointer border-primary-shadow bg-primary text-white')}
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              );
            }
            if (key === 'DEL') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={onBackspace}
                  aria-label="Effacer"
                  className={cn(KEY_BASE, 'cursor-pointer border-border-strong bg-surface text-foreground hover:bg-surface-2')}
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
                className={cn(KEY_BASE, 'min-w-9 cursor-pointer', keyStateClass(letterStates[key]))}
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
