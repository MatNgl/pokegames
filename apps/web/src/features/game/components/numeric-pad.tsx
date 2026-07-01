import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumericPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
  canSubmit?: boolean;
}

const KEY =
  'flex h-12 items-center justify-center rounded-control border-2 text-lg font-extrabold transition-colors duration-100 disabled:opacity-50 cursor-pointer';

// Pave numerique tactile : entree de nombres fiable sur mobile (jeux ou l'on saisit une valeur).
export function NumericPad({ onDigit, onBackspace, onSubmit, disabled, canSubmit }: NumericPadProps) {
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(d)}
          className={cn(KEY, 'border-border-strong bg-surface text-foreground hover:bg-surface-2')}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Effacer"
        className={cn(KEY, 'border-border-strong bg-surface text-foreground hover:bg-surface-2')}
      >
        <Delete className="h-5 w-5" />
      </button>
      <button
        key="0"
        type="button"
        disabled={disabled}
        onClick={() => onDigit('0')}
        className={cn(KEY, 'border-border-strong bg-surface text-foreground hover:bg-surface-2')}
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled || !canSubmit}
        onClick={onSubmit}
        aria-label="Valider"
        className={cn(KEY, 'border-primary-shadow bg-primary text-white')}
      >
        OK
      </button>
    </div>
  );
}
