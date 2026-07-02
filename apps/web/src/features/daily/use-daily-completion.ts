import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { getDailyStatus } from './daily-api';
import { DAILY_GAME_GROUPS, challengeKey } from './daily-challenges';

/** Renvoie l'ensemble des jeux termines a 100 % aujourd'hui (tous niveaux/modes faits). */
export function useCompletedGames(): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['daily-status'],
    queryFn: getDailyStatus,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  return useMemo(() => {
    const serverDone = new Set<string>();
    for (const r of data?.results ?? []) serverDone.add(challengeKey(r.gameType, r.scope));

    const completed = new Set<string>();
    for (const group of DAILY_GAME_GROUPS) {
      const allDone = group.challenges.every(
        (c) => serverDone.has(challengeKey(c.gameType, c.scope)) || c.localStatus() === 'done',
      );
      if (allDone) completed.add(group.gameType);
    }
    return completed;
  }, [data]);
}
