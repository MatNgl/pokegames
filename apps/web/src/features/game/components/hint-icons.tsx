import { useEffect, useRef, type ComponentType } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { WhoIsItHint, WhoIsItHintType } from '@pokegames/shared-types';
import { Hash, Lock, Ruler, Tag, Tags, Type } from 'lucide-react';
import colorRevealIcon from '@/assets/games/couleur_reveal.png';

const LUCIDE_ICONS: Partial<Record<WhoIsItHintType, ComponentType<{ className?: string }>>> = {
  TYPE_1: Tag,
  TYPE_2: Tags,
  GENERATION: Hash,
  HEIGHT: Ruler,
  FIRST_LETTER: Type,
};

function HintGlyph({ type }: { type: WhoIsItHintType }) {
  if (type === 'BLURRED_COLOR' || type === 'COLOR_SHARPEN') {
    return <img src={colorRevealIcon} alt="" className="h-5 w-5 object-contain" />;
  }
  const Icon = LUCIDE_ICONS[type];
  return Icon ? <Icon className="h-4 w-4" /> : null;
}

// Valeur affichee une fois l'indice revele (le libelle est porte par l'icone / le tooltip).
function hintValueText(hint: WhoIsItHint): string {
  if (hint.type === 'GENERATION') return `Génération ${hint.value}`;
  if (hint.type === 'BLURRED_COLOR' || hint.type === 'COLOR_SHARPEN') return 'Couleur';
  return String(hint.value);
}

interface HintIconsProps {
  hints: WhoIsItHint[];
  mistakes: number;
  busy: boolean;
  onReveal: (type: WhoIsItHintType) => void;
}

// Largeur fixe : reveler la valeur d'un indice ne doit jamais decaler la silhouette voisine.
export function HintIcons({ hints, mistakes, busy, onReveal }: HintIconsProps) {
  const reduceMotion = useReducedMotion();
  // Nombre d'erreurs au rendu precedent : sert a popper uniquement l'indice qui vient de s'ouvrir.
  const prevMistakesRef = useRef<number | null>(null);
  const previousMistakes = prevMistakesRef.current ?? mistakes;
  useEffect(() => {
    prevMistakesRef.current = mistakes;
  }, [mistakes]);

  return (
    <div className="flex w-32 shrink-0 flex-col gap-2">
      <span className="text-right font-display text-[9px] uppercase tracking-widest text-muted">
        Indices
      </span>
      {hints.map((hint) => {
        const unlocked = mistakes >= hint.unlockedAtMistakeCount;
        const plural = hint.unlockedAtMistakeCount > 1 ? 's' : '';
        const justUnlocked =
          previousMistakes < hint.unlockedAtMistakeCount &&
          hint.unlockedAtMistakeCount <= mistakes;

        if (hint.isRevealed) {
          return (
            <div key={hint.type} className="flex items-center justify-end gap-2" title={hint.label}>
              <span className="min-w-0 flex-1 truncate text-right text-xs font-bold text-foreground">
                {hintValueText(hint)}
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border-2 border-go-shadow bg-go text-go-foreground shadow-[0_2px_0_var(--color-go-shadow)]">
                <HintGlyph type={hint.type} />
              </span>
            </div>
          );
        }

        if (!unlocked) {
          return (
            <div
              key={hint.type}
              className="flex items-center justify-end gap-2"
              title={`${hint.label} : débloqué à ${hint.unlockedAtMistakeCount} erreur${plural}`}
            >
              <span className="text-[10px] font-bold text-muted/70">
                {hint.unlockedAtMistakeCount} err.
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border-2 border-border-strong bg-surface-2 text-muted/60">
                <Lock className="h-4 w-4" />
              </span>
            </div>
          );
        }

        return (
          <div key={hint.type} className="flex justify-end" title={`${hint.label} : révéler`}>
            <motion.button
              type="button"
              disabled={busy}
              onClick={() => onReveal(hint.type)}
              aria-label={`Révéler ${hint.label}`}
              initial={justUnlocked && !reduceMotion ? { scale: 0.5, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-control border-2 border-go bg-surface text-go-shadow shadow-[0_2px_0_var(--color-go)] transition-colors duration-200 hover:bg-go hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <HintGlyph type={hint.type} />
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
