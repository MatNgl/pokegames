import { cn } from '@/lib/utils';

export function SilhouetteStage({ src, revealed }: { src: string; revealed: boolean }) {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-card border border-border bg-surface-2/50">
      <div className="pointer-events-none absolute inset-0 rounded-card bg-primary-soft opacity-40 blur-2xl" />
      <img
        src={src}
        alt={revealed ? 'Pokémon révélé' : 'Silhouette à deviner'}
        draggable={false}
        className={cn(
          'relative h-4/5 w-4/5 select-none object-contain transition-all duration-500',
          revealed && 'drop-shadow-[0_0_28px_rgba(37,150,190,0.4)]',
        )}
      />
    </div>
  );
}
