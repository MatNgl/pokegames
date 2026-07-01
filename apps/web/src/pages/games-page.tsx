import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import { RefreshCwIcon } from '@/components/ui/icons/refresh-cw-icon';
import { cn } from '@/lib/utils';
import { whoIsItDailyStatus, type WhoIsItDailyStatus } from '@/features/game/daily-storage';
import { motusDailyStatus } from '@/features/game/motus-storage';
import { plusMinusDailyStatus } from '@/features/game/plus-minus-storage';
import { intruderDailyStatus } from '@/features/game/intruder-storage';
import { shinyDailyStatus } from '@/features/game/shiny-storage';
import { justStatDailyStatus } from '@/features/game/just-stat-storage';
import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import quiEstCeImg from '@/assets/games/quiestce.png';
import findShinyImg from '@/assets/games/find_shiny.png';
import findNotShinyImg from '@/assets/games/find_not_shiny.png';
import justPriceImg from '@/assets/games/just_price.png';
import leBonShinyImg from '@/assets/games/le_bon_shiny.png';

type DailyKey =
  | 'who-is-it'
  | 'motus'
  | 'plus-minus'
  | 'intruder'
  | 'shiny'
  | 'non-shiny'
  | 'just-stat';

interface GameEntry {
  title: string;
  description: string;
  to?: string;
  iconImg?: string;
  iconNode?: ReactNode;
  available: boolean;
  special?: boolean;
  dailyKey?: DailyKey;
}

function StatusBadge({ status }: { status: WhoIsItDailyStatus }) {
  if (status === 'in-progress') {
    return <Badge className="border-[#b8860b] bg-accent text-foreground">En cours</Badge>;
  }
  if (status === 'done') {
    return <Badge className="border-go-shadow bg-go text-go-foreground">Terminé</Badge>;
  }
  return null;
}

function GameCard({ game, status }: { game: GameEntry; status?: WhoIsItDailyStatus }) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col gap-3 p-4',
        game.available
          ? 'cursor-pointer transition-transform duration-100 hover:-translate-y-0.5'
          : 'opacity-70',
        game.special && 'border-primary',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[11px] uppercase leading-relaxed text-foreground sm:text-xs">
          {game.title}
        </h2>
        {status !== undefined && <StatusBadge status={status} />}
      </div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-2',
          !game.available
            ? 'border-2 border-border-strong bg-surface-2 text-muted'
            : game.special
              ? 'bg-primary text-primary-foreground'
              : 'bg-go text-go-foreground',
        )}
      >
        {game.iconNode ?? (
          <img src={game.iconImg} alt="" className="h-7 w-7 shrink-0 object-contain" />
        )}
        <span className="text-sm font-bold">{game.description}</span>
        {!game.available && (
          <span className="ml-auto text-[10px] font-bold uppercase">Bientôt</span>
        )}
      </div>
    </Card>
  );
}

function ShinyToggleCard({ statuses }: { statuses: Record<DailyKey, WhoIsItDailyStatus> }) {
  const [isReversed, setIsReversed] = useState(false);

  const currentMode = isReversed ? 'non-shiny' : 'shiny';
  const currentStatus = statuses[currentMode === 'shiny' ? 'shiny' : 'non-shiny'];
  const title = isReversed ? 'Trouve le non-shiny' : 'Trouve le shiny';
  const description = isReversed
    ? 'Le mode inversé : repère le normal'
    : 'Repère le Pokémon shiny';
  const iconImg = isReversed ? findNotShinyImg : findShinyImg;
  const to = isReversed ? '/non-shiny' : '/shiny';

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsReversed((prev) => !prev);
  }

  return (
    <Link to={to}>
      <Card
        className={cn(
          'relative flex h-full flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5',
          isReversed ? 'border-primary' : '',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[11px] uppercase leading-relaxed text-foreground sm:text-xs">
            {title}
          </h2>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={currentStatus} />
            <button
              type="button"
              onClick={handleToggle}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors duration-150 hover:bg-border hover:text-foreground"
              title="Changer de mode"
              aria-label="Basculer entre shiny et non-shiny"
            >
              <RefreshCwIcon size={14} />
            </button>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-2 transition-colors duration-200',
            isReversed
              ? 'bg-primary text-primary-foreground'
              : 'bg-go text-go-foreground',
          )}
        >
          <img src={iconImg} alt="" className="h-7 w-7 shrink-0 object-contain" />
          <span className="text-sm font-bold">{description}</span>
        </div>
      </Card>
    </Link>
  );
}

export function GamesPage() {
  const [statuses] = useState<Record<DailyKey, WhoIsItDailyStatus>>(() => ({
    'who-is-it': whoIsItDailyStatus(),
    motus: motusDailyStatus(),
    'plus-minus': plusMinusDailyStatus(),
    intruder: intruderDailyStatus(),
    shiny: shinyDailyStatus('FIND_SHINY'),
    'non-shiny': shinyDailyStatus('FIND_NON_SHINY'),
    'just-stat': justStatDailyStatus(),
  }));

  const games: GameEntry[] = [
    {
      title: 'Silhouette',
      description: 'Devine le Pokémon caché',
      to: '/jouer',
      iconImg: whoIsItImg,
      available: true,
      dailyKey: 'who-is-it',
    },
    {
      title: 'Motus',
      description: 'Trouve le nom en 6 essais',
      to: '/motus',
      iconImg: pokeMotusImg,
      available: true,
      dailyKey: 'motus',
    },
    {
      title: 'Plus ou Moins',
      description: 'Compare les statistiques',
      to: '/plus-ou-moins',
      iconImg: plusMinusImg,
      available: true,
      dailyKey: 'plus-minus',
    },
    {
      title: "L'Intrus",
      description: 'Repère celui qui ne va pas',
      to: '/intrus',
      iconImg: intrusImg,
      available: true,
      dailyKey: 'intruder',
    },
    {
      title: 'La Juste Stat',
      description: 'Devine la valeur exacte',
      to: '/juste-stat',
      iconImg: justPriceImg,
      available: true,
      dailyKey: 'just-stat',
    },
    {
      title: 'Le Bon Shiny',
      description: 'Repère le shiny authentique',
      to: '/bon-shiny',
      iconImg: leBonShinyImg,
      available: true,
    },
    { title: 'Qui est-ce', description: 'Déduction en duel', iconImg: quiEstCeImg, available: false },
  ];

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-8">
          <Logo className="text-2xl sm:text-4xl" />
          <p
            className="mt-5 text-center font-display text-[10px] leading-relaxed text-white sm:text-xs"
            style={{ textShadow: '1px 1px 0 #28338c' }}
          >
            Tous les jours, devine un Pokémon
          </p>

          <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
            {games.map((game) => {
              const status = game.dailyKey ? statuses[game.dailyKey] : undefined;

              if (game.available && game.to) {
                return (
                  <Link key={game.title} to={game.to}>
                    <GameCard game={game} status={status} />
                  </Link>
                );
              }
              return (
                <div key={game.title} aria-disabled="true">
                  <GameCard game={game} status={status} />
                </div>
              );
            })}

            <ShinyToggleCard statuses={statuses} />
          </div>
        </main>
      </div>
    </AppBackground>
  );
}
