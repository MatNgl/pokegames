import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getLeaderboard } from './daily-api';
import { resultMetric } from './daily-catalog';
import { DAILY_GAME_GROUPS } from './daily-challenges';

const TAB_BASE =
  'flex items-center gap-1.5 rounded-control border-2 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [groupKey, setGroupKey] = useState<string>(DAILY_GAME_GROUPS[0]?.key ?? 'WHO_IS_IT');
  const [scope, setScope] = useState<string>(DAILY_GAME_GROUPS[0]?.challenges[0]?.scope ?? '');

  const group = useMemo(
    () => DAILY_GAME_GROUPS.find((g) => g.key === groupKey) ?? DAILY_GAME_GROUPS[0],
    [groupKey],
  );

  const pickGame = (nextKey: string) => {
    const nextGroup = DAILY_GAME_GROUPS.find((g) => g.key === nextKey);
    setGroupKey(nextKey);
    setScope(nextGroup?.challenges[0]?.scope ?? '');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', groupKey, scope],
    queryFn: () => getLeaderboard(group?.gameType ?? '', scope),
    staleTime: 20_000,
  });

  const entries = data?.entries ?? [];

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-start justify-center px-4 py-8">
          <Card className="flex w-full max-w-xl flex-col gap-4 p-6">
            <h1 className="font-display text-sm leading-relaxed text-foreground">
              Classement du jour
            </h1>

            <div className="flex flex-wrap gap-1.5">
              {DAILY_GAME_GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  aria-pressed={g.key === groupKey}
                  onClick={() => pickGame(g.key)}
                  className={cn(
                    TAB_BASE,
                    g.key === groupKey
                      ? 'border-primary-shadow bg-primary text-primary-foreground shadow-sm scale-[1.02]'
                      : 'border-border-strong bg-surface-2/60 text-muted hover:border-primary hover:text-foreground hover:bg-surface',
                  )}
                >
                  <img src={g.iconImg} alt="" className="h-5 w-5 shrink-0 object-contain" />
                  <span>{g.label}</span>
                </button>
              ))}
            </div>

            {group && (
              <div className="flex items-center gap-3 rounded-control border-2 border-border-strong bg-surface-2/40 p-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border-2 border-border-strong bg-surface p-1 shadow-sm">
                  <img src={group.iconImg} alt="" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h2 className="font-display text-xs text-foreground">{group.label}</h2>
                  <p className="text-xs font-semibold text-muted">Classement quotidien par niveau</p>
                </div>
              </div>
            )}

            {group && group.challenges.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {group.challenges.map((c) => (
                  <button
                    key={c.scope}
                    type="button"
                    aria-pressed={c.scope === scope}
                    onClick={() => setScope(c.scope)}
                    className={cn(
                      TAB_BASE,
                      c.scope === scope
                        ? 'border-accent-shadow bg-accent text-foreground'
                        : 'border-border-strong bg-surface-2/60 text-muted hover:border-primary hover:text-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {isLoading ? (
              <Spinner className="mx-auto my-10 h-6 w-6 text-primary" />
            ) : entries.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-muted">
                Personne n'a encore joué ce défi aujourd'hui. Sois le premier !
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {entries.map((e) => (
                  <li
                    key={`${e.rank}-${e.username}`}
                    className={cn(
                      'flex items-center gap-3 rounded-control border-2 px-3 py-2',
                      e.isMe
                        ? 'border-primary bg-primary/10'
                        : 'border-border-strong bg-surface-2/60',
                    )}
                  >
                    <span className="w-7 shrink-0 text-center font-display text-xs text-primary">
                      {e.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground">
                      {e.username}
                      {e.isGuest && (
                        <span className="ml-1 text-xs font-semibold text-muted">invité</span>
                      )}
                      {e.isMe && <span className="ml-1 text-xs font-semibold text-primary">(toi)</span>}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-muted">
                      {resultMetric(e)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <Button className="w-full" onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </Card>
        </main>
      </div>
    </AppBackground>
  );
}
