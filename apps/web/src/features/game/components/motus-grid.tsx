import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MotusLetterState, MotusRoundState } from '@pokegames/shared-types';
import { cn } from '@/lib/utils';

function stateClass(state: MotusLetterState): string {
  switch (state) {
    case 'CORRECT':
      return 'border-go-shadow bg-go text-white';
    case 'PRESENT':
      return 'border-accent-shadow bg-accent text-foreground';
    case 'ABSENT':
    default:
      return 'border-absent-shadow bg-absent text-surface';
  }
}

function stateLabel(state: MotusLetterState): string {
  switch (state) {
    case 'CORRECT':
      return 'bien placée';
    case 'PRESENT':
      return 'mal placée';
    case 'ABSENT':
    default:
      return 'absente';
  }
}

interface MotusGridProps {
  state: MotusRoundState;
  // Lettres saisies par le joueur APRES la premiere lettre donnee (le suffixe).
  current: string;
  shakeKey: number;
}

const CELL =
  'flex items-center justify-center rounded-md border-2 font-display uppercase leading-none';
const FLIP_STAGGER = 0.22;
const FLIP_DURATION = 0.3;

export function MotusGrid({ state, current, shakeKey }: MotusGridProps) {
  const reduceMotion = useReducedMotion();
  const rows = Array.from({ length: state.maxAttempts }, (_, r) => r);
  const cols = Array.from({ length: state.length }, (_, c) => c);
  const currentRow = state.attempts.length;
  const isPlaying = state.status === 'PLAYING';
  const won = state.status === 'WON';

  // Ne joue le flip que sur la ligne qui vient d'etre validee (jamais a la restauration).
  const revealedRef = useRef<number | null>(null);
  const previous = revealedRef.current;
  const justRevealed =
    previous !== null && state.attempts.length > previous ? state.attempts.length - 1 : -1;
  useEffect(() => {
    revealedRef.current = state.attempts.length;
  }, [state.attempts.length]);

  // La taille des cases s'adapte a la longueur du mot : tient sur mobile sans scroll.
  const cellSize = `min(3rem, calc(min(100vw - 3rem, 30rem) / ${state.length} - 0.45rem))`;
  const tileStyle = {
    width: 'var(--cell)',
    height: 'var(--cell)',
    fontSize: 'calc(var(--cell) * 0.4)',
  };
  const winFlipEnd = state.length * FLIP_STAGGER + FLIP_DURATION;

  return (
    <div
      role="grid"
      aria-label="Grille Poké-Motus"
      className="flex flex-col items-center gap-1.5"
      style={{ ['--cell' as string]: cellSize }}
    >
      {rows.map((r) => {
        const attempt = state.attempts[r];
        const isCurrent = isPlaying && r === currentRow;
        const isReveal = !reduceMotion && r === justRevealed;
        const isWinRow = isReveal && won;
        return (
          <div
            key={isCurrent ? `current-${shakeKey}` : `row-${r}`}
            role="row"
            className={cn('flex gap-1.5', isCurrent && shakeKey > 0 && 'shake')}
          >
            {cols.map((c) => {
              if (attempt) {
                const letter = attempt.letters[c];
                const ls = letter?.state ?? 'ABSENT';
                return (
                  <motion.span
                    key={c}
                    role="img"
                    aria-label={`Lettre ${letter?.letter ?? ''}, ${stateLabel(ls)}`}
                    className={cn(CELL, stateClass(ls))}
                    style={{ ...tileStyle, transformPerspective: 600 }}
                    initial={isReveal ? { rotateX: 90 } : false}
                    animate={isWinRow ? { rotateX: 0, scale: [1, 1, 1.18, 1] } : { rotateX: 0 }}
                    transition={
                      isReveal
                        ? {
                            rotateX: { delay: c * FLIP_STAGGER, duration: FLIP_DURATION, ease: 'easeOut' },
                            scale: isWinRow
                              ? { delay: winFlipEnd + c * 0.08, duration: 0.4, ease: 'easeOut' }
                              : undefined,
                          }
                        : { duration: 0 }
                    }
                  >
                    {letter?.letter ?? ''}
                  </motion.span>
                );
              }

              const hasFirstLetter = Boolean(state.firstLetter);
              const isGiven = isCurrent && c === 0 && hasFirstLetter;
              const char = isGiven
                ? state.firstLetter
                : isCurrent
                  ? (current[hasFirstLetter ? c - 1 : c] ?? '')
                  : '';
              const cursorIndex = hasFirstLetter ? current.length + 1 : current.length;
              const isCursor = isCurrent && c === cursorIndex;
              return (
                <span
                  key={c}
                  role="img"
                  aria-label={
                    isGiven
                      ? `Première lettre donnée : ${state.firstLetter}`
                      : char
                        ? `Lettre ${char}`
                        : 'Case vide'
                  }
                  className={cn(
                    CELL,
                    isGiven
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : char
                        ? 'border-primary bg-tile text-foreground'
                        : 'border-border-strong bg-surface-2/70 text-foreground',
                    isCursor && 'motus-cursor border-primary',
                  )}
                  style={tileStyle}
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
