import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { getDailyStatus } from './daily-api';
import {
  DAILY_GAME_GROUPS,
  TOTAL_DAILY_CHALLENGES,
  challengeKey,
  type DailyChallenge,
} from './daily-challenges';

export function DailyQuestsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(true);

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

  const isDone = (c: DailyChallenge): boolean => {
    if (serverDone.has(challengeKey(c.gameType, c.scope))) return true;
    return c.localStatus() === 'done';
  };
  const isInProgress = (c: DailyChallenge): boolean =>
    !isDone(c) && c.localStatus() === 'in-progress';

  const doneCount = DAILY_GAME_GROUPS.reduce(
    (sum, g) => sum + g.challenges.filter(isDone).length,
    0,
  );
  const allDone = doneCount === TOTAL_DAILY_CHALLENGES;

  return (
    <Card className="w-full p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <span className="font-display text-xs uppercase text-foreground">Quêtes du jour</span>
        </span>
        <span className="flex items-center gap-2">
          {allDone ? (
            <Badge className="border-go-shadow bg-go text-go-foreground">Journée complète</Badge>
          ) : (
            <Badge className="border-primary bg-primary text-primary-foreground">
              {doneCount}/{TOTAL_DAILY_CHALLENGES}
            </Badge>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          {DAILY_GAME_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-1.5">
              <p className="font-display text-[9px] uppercase tracking-widest text-muted">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.challenges.map((c) => {
                  const done = isDone(c);
                  const inProgress = isInProgress(c);
                  return (
                    <button
                      key={challengeKey(c.gameType, c.scope)}
                      type="button"
                      onClick={() => navigate(c.route)}
                      className={cn(
                        'flex items-center gap-1 rounded-control border-2 px-2 py-1 text-xs font-bold transition-colors',
                        done
                          ? 'border-go-shadow bg-go/10 text-go-shadow'
                          : inProgress
                            ? 'border-accent-shadow bg-accent/20 text-foreground'
                            : 'border-border-strong bg-surface-2/60 text-muted hover:border-primary hover:text-foreground',
                      )}
                    >
                      {done && <Check className="h-3 w-3" />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
