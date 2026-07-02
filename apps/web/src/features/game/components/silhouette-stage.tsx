import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SilhouetteStageProps {
  src: string;
  revealed: boolean;
  shakeKey?: number;
  zoomRatio?: number;
  rotationAngle?: number;
}

// Scene facon ecran de console : cadre a double liseré + LED, halo lumineux derriere le Pokemon,
// ombre elliptique au sol pour ancrer la silhouette, et flash a la revelation.
export function SilhouetteStage({
  src,
  revealed,
  shakeKey = 0,
  zoomRatio = 1,
  rotationAngle = 0,
}: SilhouetteStageProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      key={shakeKey > 0 ? `shake-${shakeKey}` : 'stage'}
      className={cn(
        'relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-card border-4 border-border-strong bg-tile p-3',
        shakeKey > 0 && !revealed && 'shake',
      )}
    >
      {/* liseré console interne */}
      <div className="pointer-events-none absolute inset-1.5 rounded-[14px] border-2 border-border-strong/40" />
      {/* LED d'ecran allume */}
      <span className="absolute left-3 top-3 flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-danger shadow-[0_0_6px_rgba(238,21,21,0.8)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-go" />
      </span>
      {/* halo radial derriere le Pokemon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(255,203,5,0.28), rgba(255,203,5,0) 62%)',
        }}
      />

      {/* Pokemon (vrai sprite via proxy) + ombre au sol */}
      <div className="relative flex h-full w-full items-center justify-center">
        <motion.img
          src={src}
          alt={revealed ? 'Pokémon révélé' : 'Silhouette à deviner'}
          draggable={false}
          initial={false}
          animate={
            revealed && !reduceMotion
              ? { scale: [zoomRatio, 1.08, 1], rotate: 0 }
              : { scale: zoomRatio, rotate: rotationAngle }
          }
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className={cn(
            'relative z-10 h-4/5 w-4/5 select-none object-contain',
            revealed && 'drop-shadow-[0_0_18px_rgba(255,203,5,0.55)]',
          )}
        />
        <span
          aria-hidden
          className="absolute bottom-[9%] left-1/2 h-3 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/25 blur-[3px]"
        />
      </div>

      {/* flash de revelation */}
      {revealed && !reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 bg-white"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
}
