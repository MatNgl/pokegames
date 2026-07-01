import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SilhouetteStageProps {
  src: string;
  revealed: boolean;
  shakeKey?: number;
  zoomRatio?: number;
  rotationAngle?: number;
}

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
        'relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-card border-4 border-border-strong bg-tile',
        shakeKey > 0 && !revealed && 'shake',
      )}
    >
      <motion.img
        src={src}
        alt={revealed ? 'Pokémon révélé' : 'Silhouette à deviner'}
        draggable={false}
        animate={
          revealed && !reduceMotion
            ? { scale: [zoomRatio, 1.08, 1], rotate: 0 }
            : { scale: zoomRatio, rotate: rotationAngle }
        }
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={cn(
          'relative h-4/5 w-4/5 select-none object-contain',
          revealed && 'drop-shadow-[0_0_18px_rgba(255,203,5,0.55)]',
        )}
      />
    </div>
  );
}
