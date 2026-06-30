import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Scale, Shuffle, Type, Users } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
    title: 'Quel est ce Pokémon ?',
    description: 'Devine le Pokémon à partir de sa silhouette.',
    to: '/jouer',
    icon: Eye,
    available: true,
  },
  {
    title: 'Poké-Motus',
    description: 'Trouve le nom en six essais, à la Wordle.',
    icon: Type,
    available: false,
  },
  {
    title: 'Plus ou Moins',
    description: 'Compare les statistiques et vise juste.',
    icon: Scale,
    available: false,
  },
  {
    title: "L'Intrus",
    description: 'Repère le Pokémon qui ne suit pas la règle.',
    icon: Shuffle,
    available: false,
  },
  {
    title: 'Qui est-ce ?',
    description: 'Déduction en duel, un contre un.',
    icon: Users,
    available: false,
  },
];

export function GamesPage() {
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Choisis ton jeu</h1>
            <p className="mt-1 text-sm text-muted">
              Des mini-jeux Pokémon rapides. On commence par la silhouette à deviner.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              const Icon = game.icon;
              const card = (
                <Card
                  className={cn(
                    'flex h-full flex-col gap-3 p-5 transition-colors duration-200',
                    game.available ? 'cursor-pointer hover:border-primary/50' : 'opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {!game.available && <Badge>Bientôt</Badge>}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{game.title}</h2>
                    <p className="mt-1 text-sm text-muted">{game.description}</p>
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
