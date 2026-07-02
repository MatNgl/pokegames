import { useState, type CSSProperties } from 'react';
import { ArrowLeft, Check, Sparkles, X } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';
import { cn } from '@/lib/utils';
import { levelColor } from '../level-colors';
import { MockCreature } from './mock-creature';

// MAQUETTE A ("cartes espacees, spotlight") : arene commune aux jeux a cases (Le Bon Shiny en
// exemple). Aere, grandes cartes cremes, un projecteur derriere chaque Pokemon. Non branchee.

const LEVEL = 'MOYEN';
const RULES = [
  'Toutes les cases montrent le même Pokémon shiny.',
  'Une seule couleur est authentique, les autres sont altérées.',
  'Clique sur le shiny authentique.',
];
// index 2 = authentique (hue 0), les autres sont decales en teinte.
const TILES = [{ hue: 45 }, { hue: -60 }, { hue: 0 }, { hue: 120 }, { hue: 200 }];
const CORRECT = 2;
const TOTAL_ROUNDS = 5;
const CURRENT_ROUND = 3;

export function TileArenaMockupA() {
  const [picked, setPicked] = useState<number | null>(null);
  const solved = picked === CORRECT;

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <Card className="flex w-full max-w-2xl flex-col gap-5 p-4 sm:p-6">
            {/* En-tete */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Retour"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="font-display text-sm leading-relaxed text-foreground">Le Bon Shiny</h1>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ borderColor: levelColor(LEVEL), backgroundColor: levelColor(LEVEL), color: '#2B2A24' } as CSSProperties}
                  >
                    Moyen
                  </Badge>
                  <HelpPopover ariaLabel="Règles" rules={RULES} />
                </div>
                <div className="flex items-center gap-1" aria-label={`Manche ${CURRENT_ROUND} sur ${TOTAL_ROUNDS}`}>
                  {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
                    const n = i + 1;
                    return (
                      <span
                        key={n}
                        className={cn(
                          'h-2.5 w-2.5 rounded-full border-2',
                          n < CURRENT_ROUND && 'border-go-shadow bg-go',
                          n === CURRENT_ROUND && 'border-primary-shadow bg-primary',
                          n > CURRENT_ROUND && 'border-border-strong bg-surface-2',
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Consigne */}
            <div className="flex items-center justify-center gap-2 rounded-control bg-accent/25 py-2 text-center">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="font-display text-[10px] uppercase tracking-wide text-foreground">
                Trouve le shiny authentique
              </span>
            </div>

            {/* Grille de cases */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {TILES.map((tile, i) => {
                const isCorrect = i === CORRECT;
                const isPicked = picked === i;
                const revealed = picked !== null;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revealed}
                    onClick={() => setPicked(i)}
                    style={
                      revealed && isCorrect
                        ? ({ borderColor: '#5FB24A' } as CSSProperties)
                        : revealed && isPicked
                          ? ({ borderColor: '#EE1515' } as CSSProperties)
                          : undefined
                    }
                    className={cn(
                      'relative flex aspect-square items-center justify-center overflow-hidden rounded-card border-4 border-border-strong bg-tile p-3 shadow-[0_4px_0_rgba(43,42,36,0.15)] transition-transform duration-100',
                      !revealed && 'hover:-translate-y-0.5 hover:border-primary',
                      revealed && !isCorrect && !isPicked && 'opacity-60',
                    )}
                  >
                    {/* projecteur */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: 'radial-gradient(circle at 50% 42%, rgba(255,203,5,0.22), rgba(255,203,5,0) 60%)' }}
                    />
                    <div className="relative h-4/5 w-4/5">
                      <MockCreature hueRotate={tile.hue} />
                      <span aria-hidden className="absolute bottom-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px]" />
                    </div>
                    {revealed && isCorrect && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-go-shadow bg-go text-go-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    {revealed && isPicked && !isCorrect && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-danger bg-danger text-white">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Resultat / action */}
            <div className="flex min-h-11 items-center justify-center">
              {picked === null ? (
                <p className="text-sm font-semibold text-muted">Sélectionne une case.</p>
              ) : (
                <div className="flex items-center gap-3">
                  <span className={cn('font-display text-xs uppercase', solved ? 'text-success' : 'text-danger')}>
                    {solved ? 'Bien vu !' : 'Raté'}
                  </span>
                  <Button size="sm" onClick={() => setPicked(null)}>
                    Manche suivante
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 rounded-control border-2 border-dashed border-border-strong/60 p-2">
              <span className="font-display text-[9px] uppercase text-muted">Maquette A</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPicked(null)}>
                Reset
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </AppBackground>
  );
}
