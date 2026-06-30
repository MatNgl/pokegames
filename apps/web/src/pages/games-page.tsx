import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Scale, Shuffle, Type, Users } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

interface GameEntry {
  title: string;
  description: string;
  to?: string;
  icon: ComponentType<{ className?: string }>;
  available: boolean;
}

const games: GameEntry[] = [
  {
    title: 'Silhouette',
    description: 'Devine le Pokémon caché',
    to: '/jouer',
    icon: Eye,
    available: true,
  },
  { title: 'Motus', description: 'Trouve le nom en 6 essais', icon: Type, available: false },
  { title: 'Plus ou Moins', description: 'Compare les statistiques', icon: Scale, available: false },
  { title: "L'Intrus", description: 'Repère celui qui ne va pas', icon: Shuffle, available: false },
  { title: 'Qui est-ce', description: 'Déduction en duel', icon: Users, available: false },
];

export function GamesPage() {
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
              const Icon = game.icon;
              const card = (
                <Card
                  className={cn(
                    'flex h-full flex-col gap-3 p-4',
                    game.available
                      ? 'cursor-pointer transition-transform duration-100 hover:-translate-y-0.5'
                      : 'opacity-70',
                  )}
                >
                  <h2 className="font-display text-[11px] uppercase leading-relaxed text-foreground sm:text-xs">
                    {game.title}
                  </h2>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-2',
                      game.available
                        ? 'bg-go text-go-foreground'
                        : 'border-2 border-border-strong bg-surface-2 text-muted',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
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
