import { cn } from '@/lib/utils';

export function SilhouetteStage({ src, revealed }: { src: string; revealed: boolean }) {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-card border-4 border-border-strong bg-white">
      <img
        src={src}
        alt={revealed ? 'Pokémon révélé' : 'Silhouette à deviner'}
        draggable={false}
        className={cn(
          'relative h-4/5 w-4/5 select-none object-contain transition-all duration-500',
          revealed && 'drop-shadow-[0_0_18px_rgba(255,203,5,0.55)]',
        )}
      />
    </div>
  );
}
