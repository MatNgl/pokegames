import { useNavigate } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';

export type LevelDailyStatus = 'idle' | 'in-progress' | 'done';

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
              {options.map((option) => (
                <button
                  key={option.level}
                  type="button"
                  onClick={() => onPick(option.level)}
                  className="flex items-center justify-between gap-3 rounded-card border-4 border-border-strong bg-white p-4 text-left transition-transform duration-100 hover:-translate-y-0.5 hover:border-primary"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-xs uppercase text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-sm font-semibold text-muted">
                      {option.description}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <StatusChip status={option.status} />
                  </span>
                </button>
              ))}
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
