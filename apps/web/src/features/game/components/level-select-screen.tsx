import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';

export type LevelDailyStatus = 'idle' | 'in-progress' | 'done';

// Couleur dediee par niveau (rampe de difficulte issue de la marque : vert -> jaune -> orange -> rouge).
// Meme code pour tous les jeux a niveaux, les cles etant partagees (FACILE/MOYEN/DIFFICILE/EXTREME).
const LEVEL_COLOR: Record<string, string> = {
  FACILE: '#5FB24A',
  MOYEN: '#EAB308',
  DIFFICILE: '#E8730C',
  EXTREME: '#EE1515',
};

function levelColor(level: string): string {
  return LEVEL_COLOR[level] ?? '#3B4CCA';
}

// Teinte tres claire pour le fond de la carte (le meme ton que le rail, en transparence).
function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface LevelOption<L extends string> {
  level: L;
  label: string;
  description: string;
  status: LevelDailyStatus;
}

interface LevelSelectScreenProps<L extends string> {
  title: string;
  rules: string[];
  options: LevelOption<L>[];
  onPick: (level: L) => void;
  subtitle?: string;
}

function StatusChip({ status }: { status: LevelDailyStatus }) {
  if (status === 'in-progress') {
    return <Badge className="border-[#b8860b] bg-accent text-foreground">En cours</Badge>;
  }
  if (status === 'done') {
    return <Badge className="border-go-shadow bg-go text-go-foreground">Terminé</Badge>;
  }
  return null;
}

// Ecran de choix de niveau, partage par tous les jeux a niveaux (chaque niveau = defi quotidien
// distinct). Affiche le statut du jour par niveau (En cours / Terminé).
export function LevelSelectScreen<L extends string>({
  title,
  rules,
  options,
  onPick,
  subtitle,
}: LevelSelectScreenProps<L>) {
  const navigate = useNavigate();
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <Card className="flex w-full max-w-md flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-sm leading-relaxed text-foreground">{title}</h1>
              <HelpPopover ariaLabel={`Règles de ${title}`} rules={rules} />
            </div>
            {subtitle && <p className="text-sm font-semibold text-muted">{subtitle}</p>}
            <div className="flex flex-col gap-3">
              {options.map((option) => {
                const color = levelColor(option.level);
                return (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => onPick(option.level)}
                    style={{ '--lvl': color, backgroundColor: hexToRgba(color, 0.08) } as CSSProperties}
                    className="group relative flex items-stretch gap-0 overflow-hidden rounded-card border-4 border-border-strong text-left transition-transform duration-100 hover:-translate-y-0.5 hover:border-[color:var(--lvl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lvl)] focus-visible:ring-offset-2"
                  >
                    {/* Rail colore : repere de niveau immediat. */}
                    <span aria-hidden className="w-2.5 shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex flex-1 items-center justify-between gap-3 p-4">
                      <span className="min-w-0">
                        <span className="mb-0.5 flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-display text-xs uppercase text-foreground">
                            {option.label}
                          </span>
                        </span>
                        <span className="block text-sm font-semibold text-muted">
                          {option.description}
                        </span>
                      </span>
                      <span className="shrink-0">
                        <StatusChip status={option.status} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </Card>
        </main>
      </div>
    </AppBackground>
  );
}
