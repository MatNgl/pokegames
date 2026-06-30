import type { ComponentType } from 'react';
import type { WhoIsItHint, WhoIsItHintType } from '@pokegames/shared-types';
import { Hash, Lock, Palette, Tag, Tags, Type } from 'lucide-react';

const ICONS: Record<WhoIsItHintType, ComponentType<{ className?: string }>> = {
  BLURRED_COLOR: Palette,
  TYPE_1: Tag,
  TYPE_2: Tags,
  GENERATION: Hash,
  FIRST_LETTER: Type,
};

interface HintIconsProps {
  hints: WhoIsItHint[];
  mistakes: number;
  busy: boolean;
  onReveal: (type: WhoIsItHintType) => void;
}

// Indices compacts a droite de la silhouette : une icone par indice, revelee au clic quand elle est debloquee.
export function HintIcons({ hints, mistakes, busy, onReveal }: HintIconsProps) {
  return (
    <div className="flex flex-col gap-2">
      {hints.map((hint) => {
        const Icon = ICONS[hint.type];
        const unlocked = mistakes >= hint.unlockedAtMistakeCount;
        const plural = hint.unlockedAtMistakeCount > 1 ? 's' : '';

        if (hint.isRevealed) {
          return (
            <div key={hint.type} className="flex items-center justify-end gap-2" title={hint.label}>
              <span className="text-xs font-medium text-foreground">{String(hint.value)}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary-soft text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </div>
          );
        }

        if (!unlocked) {
          return (
            <div
              key={hint.type}
              className="flex justify-end"
              title={`${hint.label} : débloqué à ${hint.unlockedAtMistakeCount} erreur${plural}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-control border border-border text-muted/40">
                <Lock className="h-4 w-4" />
              </span>
            </div>
          );
        }

        return (
          <div
            key={hint.type}
            className="flex justify-end"
            title={`${hint.label} : révéler (coût ${hint.cost} pts)`}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => onReveal(hint.type)}
              aria-label={`Révéler ${hint.label}`}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-primary/50 text-primary transition-colors duration-200 hover:bg-primary-soft disabled:opacity-50"
            >
              <Icon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
