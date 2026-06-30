import { Card } from '@/components/ui/card';

// Squelette pendant le chargement de la manche : meme gabarit que le jeu, zero saut visuel.
export function WhoIsItSkeleton() {
  return (
    <Card className="flex w-full max-w-xl flex-col gap-5 p-6" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="h-5 w-48 animate-pulse rounded bg-surface-2" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-surface-2" />
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="aspect-square w-full max-w-xs animate-pulse rounded-card bg-surface-2" />
        <div className="flex w-32 shrink-0 flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ml-auto h-9 w-9 animate-pulse rounded-control bg-surface-2" />
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md gap-2">
        <div className="h-11 flex-1 animate-pulse rounded-control bg-surface-2" />
        <div className="h-11 w-24 animate-pulse rounded-control bg-surface-2" />
      </div>
    </Card>
  );
}
