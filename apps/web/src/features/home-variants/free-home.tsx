import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HOME_GAMES } from './games-list';

// Variante C (libre) : un jeu "vedette" mis en avant + une grille compacte des autres.
export function FreeHome() {
  const featured = HOME_GAMES[0];
  const rest = HOME_GAMES.slice(1);

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
          <div className="text-center">
            <h1 className="font-display text-2xl text-accent" style={{ textShadow: '2px 2px 0 #28338c' }}>
              PokéGames
            </h1>
            <p
              className="mt-3 font-display text-[10px] leading-relaxed text-white sm:text-xs"
              style={{ textShadow: '1px 1px 0 #28338c' }}
            >
              Ton rendez-vous quotidien de dresseur
            </p>
          </div>

          {/* Jeu vedette */}
          {featured && (
            <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-6 sm:flex-row sm:gap-6 sm:p-8">
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-display text-[9px] uppercase text-foreground">
                <Sparkles className="h-3 w-3" /> Vedette du jour
              </span>
              <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-card border-4 border-border-strong bg-primary/10">
                <img src={featured.iconImg} alt="" className="h-28 w-28 object-contain" draggable={false} />
              </div>
              <div className="flex flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                <h2 className="font-display text-lg uppercase leading-relaxed text-foreground">
                  {featured.title}
                </h2>
                <p className="text-sm font-semibold text-muted">{featured.description}</p>
                <Link to={featured.to} className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">Relever le défi</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Les autres jeux, en tuiles compactes */}
          <div>
            <h3 className="mb-3 font-display text-xs uppercase text-white" style={{ textShadow: '1px 1px 0 #28338c' }}>
              Tous les jeux
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((game) => (
                <Link key={game.title} to={game.to}>
                  <Card className="flex h-full flex-col items-center gap-2 p-3 text-center transition-transform duration-100 hover:-translate-y-0.5 hover:border-primary">
                    <div className="flex h-16 w-16 items-center justify-center rounded-card border-2 border-border-strong bg-go/10">
                      <img src={game.iconImg} alt="" className="h-12 w-12 object-contain" draggable={false} />
                    </div>
                    <span className="font-display text-[9px] uppercase leading-relaxed text-foreground">
                      {game.title}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </AppBackground>
  );
}
