import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TileGridProps {
  children: ReactNode[]; // une PokemonTile par entree
  className?: string;
}

// Dispose les cases selon leur nombre. Cas particulier a 5 : 3 en haut, 2 en bas centrees sous les
// espaces des 3 du dessus (grille 6 colonnes, cases sur 2 colonnes chacune).
export function TileGrid({ children, className }: TileGridProps) {
  const count = children.length;

  if (count === 5) {
    const spans = [
      'col-span-2',
      'col-span-2',
      'col-span-2',
      'col-span-2 col-start-2',
      'col-span-2 col-start-4',
    ];
    return (
      <div className={cn('grid w-full max-w-md grid-cols-6 gap-3 sm:gap-4', className)}>
        {children.map((child, i) => (
          <div key={i} className={spans[i]}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  const cols = count === 2 ? 'grid-cols-2' : count === 4 ? 'grid-cols-2' : 'grid-cols-3';
  const width = count <= 2 ? 'max-w-sm' : count === 4 ? 'max-w-sm' : 'max-w-md';

  return (
    <div className={cn('grid w-full gap-3 sm:gap-4', cols, width, className)}>
      {children.map((child, i) => (
        <div key={i}>{child}</div>
      ))}
    </div>
  );
}
