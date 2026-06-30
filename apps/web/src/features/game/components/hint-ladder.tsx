import type { WhoIsItHint, WhoIsItHintType } from '@pokegames/shared-types';
import { Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HintLadderProps {
  hints: WhoIsItHint[];
  mistakes: number;
  busy: boolean;
  onReveal: (type: WhoIsItHintType) => void;
}

export function HintLadder({ hints, mistakes, busy, onReveal }: HintLadderProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Indices</h3>
      <ul className="flex flex-col gap-2">
        {hints.map((hint) => {
          const unlocked = mistakes >= hint.unlockedAtMistakeCount;
          return (
            <li
              key={hint.type}
              className={cn(
                'flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2/50 px-3 py-2',
                !unlocked && 'opacity-60',
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">{hint.label}</span>
                {hint.isRevealed ? (
                  <span className="truncate text-sm text-primary">{String(hint.value)}</span>
                ) : (
                  <span className="text-xs text-muted">
                    {unlocked
                      ? `Coût ${hint.cost} pts`
                      : `Débloqué à ${hint.unlockedAtMistakeCount} erreur${hint.unlockedAtMistakeCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              {hint.isRevealed ? (
                <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              ) : unlocked ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onReveal(hint.type)}>
                  Révéler
                </Button>
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
