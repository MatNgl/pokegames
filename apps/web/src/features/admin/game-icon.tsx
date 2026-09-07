import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import quiEstCeImg from '@/assets/games/quiestce.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';
import lePokedexImg from '@/assets/games/le-pokedex.png';
import { gameLabel } from '@/features/daily/daily-catalog';
import { cn } from '@/lib/utils';

// gameType renvoye par l'API -> vignette du jeu. Un seul visuel pour SHINY : le mode inverse
// (non-shiny) partage le meme gameType cote serveur, il se distingue par le scope.
const ICON_BY_GAME: Record<string, string> = {
  WHO_IS_IT: whoIsItImg,
  MOTUS: pokeMotusImg,
  PLUS_MINUS: plusMinusImg,
  INTRUDER: intrusImg,
  JUST_STAT: justPriceImg,
  TRUE_SHINY: leBonShinyImg,
  SHINY: findShinyImg,
  GUESS_WHO: quiEstCeImg,
  POKEDEX: lePokedexImg,
};

/** Vignette du jeu : repere visuel immediat dans les listes, qui evitent de lire chaque libelle. */
export function GameIcon({ gameType, className }: { gameType: string; className?: string }) {
  const src = ICON_BY_GAME[gameType];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('h-6 w-6 shrink-0 object-contain', className)}
    />
  );
}

/** Vignette + nom du jeu, la forme utilisee dans toutes les listes de l'admin. */
export function GameTag({
  gameType,
  suffix,
  className,
}: {
  gameType: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <GameIcon gameType={gameType} />
      <span className="min-w-0 truncate">
        <span className="font-bold text-foreground">{gameLabel(gameType)}</span>
        {suffix && <span className="font-semibold text-muted"> · {suffix}</span>}
      </span>
    </span>
  );
}
