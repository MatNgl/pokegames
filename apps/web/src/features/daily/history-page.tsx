import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DailyResultDTO } from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/features/auth/auth-context';
import { getDailyHistory } from './daily-api';
import { gameIconImg, gameLabel, resultMetric, scopeLabel } from './daily-catalog';

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-start justify-center px-4 py-8">{children}</main>
      </div>
    </AppBackground>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['daily-history'],
    queryFn: () => getDailyHistory(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const results = data?.results ?? [];

  const summary = useMemo(() => {
    const total = results.length;
    const wins = results.filter((r) => r.won).length;
    return { total, wins };
  }, [results]);

  const byDay = useMemo(() => {
    const map = new Map<string, DailyResultDTO[]>();
    for (const r of results) {
      const list = map.get(r.dayDate) ?? [];
      list.push(r);
      map.set(r.dayDate, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [results]);

  if (initializing) {
    return (
      <Shell>
        <Spinner className="mt-16 h-7 w-7 text-primary" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-sm leading-relaxed text-foreground">Historique</h1>
          <p className="text-sm font-semibold text-muted">
            Connecte-toi pour sauvegarder tes défis et suivre ton historique. En invité, tes
            résultats restent sur cet appareil et ne sont pas enregistrés.
          </p>
          <Button variant="go" className="w-full" onClick={() => navigate('/connexion', { state: { from: '/historique' } })}>
            Se connecter
          </Button>
          <Button className="w-full" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="flex w-full max-w-xl flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-sm leading-relaxed text-foreground">Mon historique</h1>
          <div className="flex gap-2">
            <Badge className="border-primary bg-primary text-primary-foreground">
              {summary.total} défi{summary.total > 1 ? 's' : ''}
            </Badge>
            <Badge className="border-go-shadow bg-go text-go-foreground">
              {summary.wins} réussi{summary.wins > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-muted">
            Aucun défi terminé pour l'instant. Va jouer, ça s'affichera ici.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {byDay.map(([day, rows]) => (
              <div key={day} className="flex flex-col gap-2">
                <p className="font-display text-[10px] uppercase tracking-widest text-muted">
                  {formatDay(day)}
                </p>
                {rows.map((r) => {
                  const icon = gameIconImg(r.gameType, r.scope);
                  return (
                    <div
                      key={`${r.gameType}:${r.scope}`}
                      className="flex items-center justify-between gap-3 rounded-control border-2 border-border-strong bg-surface-2/60 p-2.5 transition-colors hover:border-primary/50 hover:bg-surface"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-border-strong bg-surface p-1 shadow-sm">
                          <img src={icon} alt="" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-foreground">
                            {gameLabel(r.gameType, r.scope)}
                            {scopeLabel(r.scope) && (
                              <span className="font-semibold text-muted">
                                {' · '}
                                {scopeLabel(r.scope)}
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-semibold text-muted">{resultMetric(r)}</p>
                        </div>
                      </div>
                      <Badge
                        className={
                          r.won
                            ? 'border-go-shadow bg-go text-go-foreground shrink-0'
                            : 'border-border-strong bg-surface text-muted shrink-0'
                        }
                      >
                        {r.won ? 'Réussi' : 'Terminé'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </Card>
    </Shell>
  );
}
