import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { whoIsItDailyStatus, type WhoIsItDailyStatus } from '@/features/game/daily-storage';
import { motusDailyStatus } from '@/features/game/motus-storage';
import whoIsItImg from '@/assets/games/who-is-it.png';
import pokeMotusImg from '@/assets/games/poke-motus.png';
import plusMinusImg from '@/assets/games/plus-minus.png';
import intrusImg from '@/assets/games/intrus.png';
import quiEstCeImg from '@/assets/games/quiestce.png';

type DailyKey = 'who-is-it' | 'motus';

interface GameEntry {
  title: string;
  description: string;
  to?: string;
  iconImg: string;
  available: boolean;
  dailyKey?: DailyKey;
}

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
    iconImg: plusMinusImg,
    available: false,
  },
  { title: "L'Intrus", description: 'Repère celui qui ne va pas', iconImg: intrusImg, available: false },
  { title: 'Qui est-ce', description: 'Déduction en duel', iconImg: quiEstCeImg, available: false },
];

function StatusBadge({ status }: { status: WhoIsItDailyStatus }) {
  if (status === 'in-progress') {
    return <Badge className="border-[#b8860b] bg-accent text-foreground">En cours</Badge>;
  }
  if (status === 'done') {
    return <Badge className="border-go-shadow bg-go text-go-foreground">Terminé</Badge>;
  }
  return null;
}

export function GamesPage() {
  const [statuses] = useState<Record<DailyKey, WhoIsItDailyStatus>>(() => ({
    'who-is-it': whoIsItDailyStatus(),
    motus: motusDailyStatus(),
  }));

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
              const card = (
                <Card
                  className={cn(
                    'flex h-full flex-col gap-3 p-4',
                    game.available
                      ? 'cursor-pointer transition-transform duration-100 hover:-translate-y-0.5'
                      : 'opacity-70',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-[11px] uppercase leading-relaxed text-foreground sm:text-xs">
                      {game.title}
                    </h2>
                    {game.dailyKey && <StatusBadge status={statuses[game.dailyKey]} />}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-2',
                      game.available
                        ? 'bg-go text-go-foreground'
                        : 'border-2 border-border-strong bg-surface-2 text-muted',
                    )}
                  >
                    <img src={game.iconImg} alt="" className="h-7 w-7 shrink-0 object-contain" />
                    <span className="text-sm font-bold">{game.description}</span>
                    {!game.available && (
                      <span className="ml-auto text-[10px] font-bold uppercase">Bientôt</span>
                    )}
                  </div>
                </Card>
              );

              return game.available && game.to ? (
                <Link key={game.title} to={game.to}>
                  {card}
                </Link>
              ) : (
                <div key={game.title} aria-disabled="true">
                  {card}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </AppBackground>
  );
}
