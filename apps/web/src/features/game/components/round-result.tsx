import type { WhoIsItGuessResponse } from '@pokegames/shared-types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface RoundResultProps {
  result: WhoIsItGuessResponse;
  spriteUrl: string;
  onNext: () => void;
}

export function RoundResult({ result, spriteUrl, onNext }: RoundResultProps) {
  const pokemon = result.revealedPokemon;

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-widest text-success">Trouvé</span>
      {pokemon && (
        <>
          <img src={spriteUrl} alt={pokemon.nameFr} className="h-32 w-32 object-contain" draggable={false} />
          <div>
            <p className="text-xl font-bold text-foreground">{pokemon.nameFr}</p>
            <p className="text-sm text-muted">Génération {pokemon.generation}</p>
          </div>
        </>
      )}
      <p className="text-3xl font-bold text-primary">{result.currentScore} pts</p>
      <Button onClick={onNext} className="w-full">
        Manche suivante
      </Button>
    </Card>
  );
}
