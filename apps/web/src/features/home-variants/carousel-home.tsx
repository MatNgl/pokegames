import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HOME_GAMES } from './games-list';

// Variante A : carrousel horizontal a defilement (snap), un jeu par carte.
export function CarouselHome() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(360, el.clientWidth * 0.9), behavior: 'smooth' });
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
          <h1 className="text-center font-display text-2xl text-accent" style={{ textShadow: '2px 2px 0 #28338c' }}>
            PokéGames
          </h1>
          <p
            className="mb-6 mt-3 text-center font-display text-[10px] leading-relaxed text-white sm:text-xs"
            style={{ textShadow: '1px 1px 0 #28338c' }}
          >
            Fais défiler et choisis ton défi du jour
          </p>

          <div className="relative">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Précédent"
              className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border-4 border-border-strong bg-surface p-2 text-foreground shadow-[0_4px_0_rgba(63,93,29,0.3)] hover:bg-surface-2 sm:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <div
              ref={trackRef}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-4 sm:px-12"
              style={{ scrollbarWidth: 'none' }}
            >
              {HOME_GAMES.map((game) => (
                <Card
                  key={game.title}
                  className="flex w-[78%] shrink-0 snap-center flex-col items-center gap-4 p-6 text-center sm:w-80"
                >
                  <div className="flex h-32 w-32 items-center justify-center rounded-card border-4 border-border-strong bg-go/15">
                    <img src={game.iconImg} alt="" className="h-24 w-24 object-contain" draggable={false} />
                  </div>
                  <h2 className="font-display text-sm uppercase leading-relaxed text-foreground">
                    {game.title}
                  </h2>
                  <p className="text-sm font-semibold text-muted">{game.description}</p>
                  <Link to={game.to} className="w-full">
                    <Button className="w-full">Jouer</Button>
                  </Link>
                </Card>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Suivant"
              className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border-4 border-border-strong bg-surface p-2 text-foreground shadow-[0_4px_0_rgba(63,93,29,0.3)] hover:bg-surface-2 sm:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          <p className="mt-4 text-center text-xs font-semibold text-white/80">
            Glisse ou utilise les flèches
          </p>
        </main>
      </div>
    </AppBackground>
  );
}
