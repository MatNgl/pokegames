import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Etat d'une case apres reponse : neutre, bonne, mauvaise (choisie), ou estompee (non concernee).
export type TileResult = 'none' | 'correct' | 'wrong' | 'dimmed';

interface PokemonTileProps {
  src: string; // URL de l'image (deja absolue)
  alt?: string;
  ariaLabel?: string; // nom accessible du bouton (les cases n'ont pas toujours de texte visible)
  onClick?: () => void;
  disabled?: boolean;
  result?: TileResult;
  pixelated?: boolean;
  mark?: ReactNode; // petit repere coin haut-gauche (ex. etoile shiny apres revelation)
  caption?: ReactNode; // legende sous le Pokemon (ex. nom apres revelation)
  className?: string;
}

// Case commune aux jeux "cases" (Le Bon Shiny, Trouve le shiny / non-shiny, L'Intrus, Plus ou Moins) :
// carte creme aeree, projecteur radial derriere le Pokemon, ombre au sol, anneau de resultat.
// Remplit sa cellule : la mise en page (nombre de colonnes, rangee 3+2) est geree par TileGrid.
export function PokemonTile({
  src,
  alt = '',
  ariaLabel,
  onClick,
  disabled = false,
  result = 'none',
  pixelated = false,
  mark,
  caption,
  className,
}: PokemonTileProps) {
  const reduceMotion = useReducedMotion();
  const revealed = result !== 'none';

  const borderStyle: CSSProperties | undefined =
    result === 'correct'
      ? { borderColor: '#5FB24A' }
      : result === 'wrong'
        ? { borderColor: '#EE1515' }
        : undefined;

  const animate =
    reduceMotion || !revealed
      ? {}
      : result === 'correct'
        ? { scale: [1, 1.06, 1] }
        : result === 'wrong'
          ? { x: [0, -6, 6, -4, 4, 0] }
          : {};

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      animate={animate}
      transition={{ duration: 0.45 }}
      style={borderStyle}
      className={cn(
        'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-card border-4 border-border-strong bg-tile p-3 shadow-[0_4px_0_rgba(43,42,36,0.15)] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        !revealed && !disabled && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary',
        result === 'dimmed' && 'opacity-60',
        className,
      )}
    >
      {/* projecteur */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 42%, rgba(255,203,5,0.22), rgba(255,203,5,0) 60%)' }}
      />
      <div className="relative h-4/5 w-4/5">
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="relative z-10 h-full w-full object-contain"
          style={pixelated ? { imageRendering: 'pixelated' } : undefined}
        />
        <span
          aria-hidden
          className="absolute bottom-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px]"
        />
      </div>

      {mark && <span className="absolute left-1.5 top-1.5 z-20">{mark}</span>}

      {caption && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-0.5 bg-surface/85 px-1 py-1 text-center">
          {caption}
        </div>
      )}

      {result === 'correct' && (
        <span className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-go-shadow bg-go text-go-foreground">
          <Check className="h-4 w-4" />
        </span>
      )}
      {result === 'wrong' && (
        <span className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-danger bg-danger text-white">
          <X className="h-4 w-4" />
        </span>
      )}
    </motion.button>
  );
}
