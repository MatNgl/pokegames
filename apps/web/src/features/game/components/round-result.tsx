import type { WhoIsItGuessResponse } from '@pokegames/shared-types';
import { Button } from '@/components/ui/button';

interface RoundResultProps {
  result: WhoIsItGuessResponse;
  spriteUrl: string;
  onNext: () => void;
  nextLabel?: string;
}

export function RoundResult({
  result,
  spriteUrl,
  onNext,
  nextLabel = 'Manche suivante',
}: RoundResultProps) {
  const pokemon = result.revealedPokemon;
  const attempts = result.mistakesCount + 1;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="font-display text-[10px] uppercase tracking-widest text-success">Trouvé</span>
      {pokemon && (
        <>
          <img src={spriteUrl} alt={pokemon.nameFr} className="h-32 w-32 object-contain" draggable={false} />
          <div>
            <p className="text-xl font-extrabold text-foreground">{pokemon.nameFr}</p>
            <p className="text-sm font-semibold text-muted">Génération {pokemon.generation}</p>
          </div>
        </>
      )}
      <p className="text-sm font-bold text-foreground">
        Trouvé en {attempts} essai{attempts > 1 ? 's' : ''}
      </p>
      <Button onClick={onNext} className="w-full max-w-xs">
        {nextLabel}
      </Button>
    </div>
  );
}
