import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { getDailyStatus } from './daily-api';
import { DAILY_GAME_GROUPS, TOTAL_DAILY_CHALLENGES, challengeKey } from './daily-challenges';

// Panneau de quetes compact et lisible : par jeu, une progression fait/total.
export function SimpleQuestsPanel() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['daily-status'],
    queryFn: getDailyStatus,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const serverDone = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.results ?? []) set.add(challengeKey(r.gameType, r.scope));
    return set;
  }, [data]);

  const groups = DAILY_GAME_GROUPS.map((g) => {
    const done = g.challenges.filter(
      (c) => serverDone.has(challengeKey(c.gameType, c.scope)) || c.localStatus() === 'done',
    ).length;
    return { key: g.key, label: g.label, done, total: g.challenges.length };
  });
  const totalDone = groups.reduce((s, g) => s + g.done, 0);
  const allDone = totalDone === TOTAL_DAILY_CHALLENGES;

  return (
    <Card className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[11px] uppercase text-foreground">Quêtes du jour</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-display text-[10px]',
            allDone ? 'bg-go text-go-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {totalDone}/{TOTAL_DAILY_CHALLENGES}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const complete = g.done === g.total;
          return (
            <div key={g.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className={cn('truncate', complete ? 'text-go-shadow' : 'text-foreground')}>
                  {complete && <Check className="mr-1 inline h-3 w-3" />}
                  {g.label}
                </span>
                <span className="shrink-0 text-muted">
                  {g.done}/{g.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn('h-full rounded-full transition-all', complete ? 'bg-go' : 'bg-primary')}
                  style={{ width: `${(g.done / g.total) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!user && (
        <p className="text-[11px] font-semibold text-muted">
          Connecte-toi pour suivre tes quêtes sur tous tes appareils.
        </p>
      )}
    </Card>
  );
}
