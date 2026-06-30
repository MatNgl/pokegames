import { cn } from '@/lib/utils';

// Logo facon jeu retro : police pixel, jaune Pokemon avec contour bleu.
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-display text-sm leading-none text-accent', className)}
      style={{
        textShadow:
          '2px 2px 0 #28338c, -2px 2px 0 #28338c, 2px -2px 0 #28338c, -2px -2px 0 #28338c, 0 3px 0 #28338c',
      }}
    >
      PokéGames
    </span>
  );
}
