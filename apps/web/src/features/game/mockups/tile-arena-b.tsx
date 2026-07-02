import { useState, type CSSProperties } from 'react';
import { ArrowLeft, Check, Sparkles, X } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';
import { cn } from '@/lib/utils';
import { levelColor } from '../level-colors';
import { MockCreature } from './mock-creature';

// MAQUETTE B ("plateau Pokedex compact") : meme arene commune, style boitier/console. Panneau
// encadre (double liseré + vis), bandeau titre a la couleur du niveau, cases en creux numerotees,
// selection qui s'allume. Plus dense et "device". Non branchee.

const LEVEL = 'MOYEN';
const COLOR = levelColor(LEVEL);
const RULES = [
  'Toutes les cases montrent le même Pokémon shiny.',
  'Une seule couleur est authentique, les autres sont altérées.',
  'Clique sur le shiny authentique.',
];
const TILES = [{ hue: 45 }, { hue: -60 }, { hue: 0 }, { hue: 120 }, { hue: 200 }];
const CORRECT = 2;
const TOTAL_ROUNDS = 5;
const CURRENT_ROUND = 3;

function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute h-2.5 w-2.5 rounded-full border-2 border-border-strong bg-surface-2', className)}
    />
  );
}

export function TileArenaMockupB() {
  const [picked, setPicked] = useState<number | null>(null);
  const solved = picked === CORRECT;

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <Card className="flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
            {/* En-tete compact */}
            <div className="flex items-center justify-between gap-2">
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
              <HelpPopover ariaLabel="Règles" rules={RULES} />
            </div>

            {/* Plateau encadre facon boitier */}
            <div className="relative rounded-card border-4 border-border-strong bg-surface-2/50 p-3 pt-0">
              <div className="pointer-events-none absolute inset-1.5 rounded-[14px] border-2 border-border-strong/30" />
              <Screw className="left-2 top-2" />
              <Screw className="right-2 top-2" />
              <Screw className="bottom-2 left-2" />
              <Screw className="bottom-2 right-2" />

              {/* Bandeau titre a la couleur du niveau */}
              <div
                className="-mx-3 mb-3 flex items-center justify-between gap-2 rounded-t-[10px] px-4 py-2"
                style={{ backgroundColor: COLOR }}
              >
                <span className="flex items-center gap-1.5 font-display text-[10px] uppercase text-[#2B2A24]">
                  <Sparkles className="h-3.5 w-3.5" /> Shiny authentique
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-[10px] text-[#2B2A24]">MOYEN</span>
                  <span className="rounded-full bg-[#2B2A24]/15 px-2 py-0.5 font-display text-[10px] text-[#2B2A24]">
                    {CURRENT_ROUND}/{TOTAL_ROUNDS}
                  </span>
                </div>
              </div>

              {/* Grille de cases en creux, numerotees */}
              <div className="grid grid-cols-3 gap-2">
                {TILES.map((tile, i) => {
                  const isCorrect = i === CORRECT;
                  const isPicked = picked === i;
                  const revealed = picked !== null;
                  const highlight = revealed
                    ? isCorrect
                      ? '#5FB24A'
                      : isPicked
                        ? '#EE1515'
                        : undefined
                    : undefined;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={revealed}
                      onClick={() => setPicked(i)}
                      style={
                        {
                          '--hl': COLOR,
                          ...(highlight ? { borderColor: highlight, backgroundColor: `${highlight}14` } : {}),
                        } as CSSProperties
                      }
                      className={cn(
                        'relative flex aspect-square items-center justify-center overflow-hidden rounded-control border-2 border-border-strong/60 bg-tile shadow-[inset_0_2px_6px_rgba(43,42,36,0.18)] transition-colors',
                        !revealed && 'hover:border-[color:var(--hl)] hover:bg-[color:var(--hl)]/10',
                        revealed && !isCorrect && !isPicked && 'opacity-55',
                      )}
                    >
                      <span className="absolute left-1 top-0.5 font-display text-[9px] text-muted/70">
                        {i + 1}
                      </span>
                      <div className="h-3/4 w-3/4">
                        <MockCreature hueRotate={tile.hue} />
                      </div>
                      {revealed && isCorrect && (
                        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-go text-go-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {revealed && isPicked && !isCorrect && (
                        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white">
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
              <span className="font-display text-[9px] uppercase text-muted">Maquette B</span>
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
