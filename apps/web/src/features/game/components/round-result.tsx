import type { WhoIsItGuessResponse } from '@pokegames/shared-types';
import { Button } from '@/components/ui/button';

interface RoundResultProps {
  result: WhoIsItGuessResponse;
  onNext: () => void;
  nextLabel?: string;
}

// Bloc d'infos affiche apres la revelation du Pokemon (le sprite couleur est rendu dans la scene).
export function RoundResult({ result, onNext, nextLabel = 'Manche suivante' }: RoundResultProps) {
  const pokemon = result.revealedPokemon;
  const attempts = result.mistakesCount + 1;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="font-display text-[10px] uppercase tracking-widest text-success">Trouvé</span>
      {pokemon && (
        <div>
          <p className="text-xl font-extrabold text-foreground">{pokemon.nameFr}</p>
          <p className="text-sm font-semibold text-muted">Génération {pokemon.generation}</p>
        </div>
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
