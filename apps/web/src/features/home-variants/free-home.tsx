import { Link } from 'react-router-dom';
import { Sparkles, Swords } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleQuestsPanel } from '@/features/daily/simple-quests-panel';
import { HOME_GAMES, type HomeGame } from './games-list';

// Vedette du jour : deterministe (change chaque jour), identique pour tous.
function featuredIndex(count: number): number {
  const day = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) % 2147483647;
  return seed % count;
}

function GameTile({ game }: { game: HomeGame }) {
  return (
    <Link to={game.to}>
      <Card className="flex h-full flex-col items-center gap-2 p-3 text-center transition-transform duration-100 hover:-translate-y-0.5 hover:border-primary">
        <div className="flex h-16 w-16 items-center justify-center rounded-card border-2 border-border-strong bg-go/10">
          <img src={game.iconImg} alt="" className="h-12 w-12 object-contain" draggable={false} />
        </div>
        <span className="font-display text-[9px] uppercase leading-relaxed text-foreground">
          {game.title}
        </span>
      </Card>
    </Link>
  );
}

// Variante C (libre, page de reference) : vedette du jour + quetes a gauche + Solo / Multijoueur.
export function FreeHome() {
  const solo = HOME_GAMES.filter((g) => g.title !== 'Qui est-ce');
  const multi = HOME_GAMES.filter((g) => g.title === 'Qui est-ce');
  const fIndex = featuredIndex(solo.length);
  const featured = solo[fIndex];
  const rest = solo.filter((_, i) => i !== fIndex);

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
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

          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
            {/* Quetes a gauche (simplifiees). Sur mobile : sous les jeux. */}
            <aside className="order-last w-full xl:order-first xl:w-64 xl:shrink-0">
              <SimpleQuestsPanel />
            </aside>

            <div className="flex flex-1 flex-col gap-6">
              {/* Jeu vedette du jour */}
              {featured && (
                <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-6 sm:flex-row sm:gap-6 sm:p-8">
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-display text-[9px] uppercase text-foreground">
                    <Sparkles className="h-3 w-3" /> Vedette du jour
                  </span>
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-card border-4 border-border-strong bg-primary/10">
                    <img src={featured.iconImg} alt="" className="h-24 w-24 object-contain" draggable={false} />
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

              {/* Jeux solo */}
              <div>
                <h3 className="mb-3 font-display text-xs uppercase text-white" style={{ textShadow: '1px 1px 0 #28338c' }}>
                  Défis solo du jour
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {rest.map((game) => (
                    <GameTile key={game.title} game={game} />
                  ))}
                </div>
              </div>

              {/* Jeux multijoueur */}
              {multi.length > 0 && (
                <div>
                  <h3
                    className="mb-3 flex items-center gap-1.5 font-display text-xs uppercase text-white"
                    style={{ textShadow: '1px 1px 0 #28338c' }}
                  >
                    <Swords className="h-4 w-4" /> Multijoueur
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {multi.map((game) => (
                      <Link key={game.title} to={game.to}>
                        <Card className="flex h-full items-center gap-3 border-primary p-3 transition-transform duration-100 hover:-translate-y-0.5">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card border-2 border-border-strong bg-primary/10">
                            <img src={game.iconImg} alt="" className="h-10 w-10 object-contain" draggable={false} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-[10px] uppercase text-foreground">{game.title}</p>
                            <p className="truncate text-xs font-semibold text-muted">{game.description}</p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppBackground>
  );
}
