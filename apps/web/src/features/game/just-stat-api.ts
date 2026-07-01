import { api } from '@/lib/api';
import type { JustStatGuessResponse, JustStatRoundState } from '@pokegames/shared-types';

export async function startJustStat(): Promise<JustStatRoundState> {
  const res = await api.post<JustStatRoundState>('/games/just-stat/start', {});
  return res.data;
}

export async function getJustStatRound(roundId: string): Promise<JustStatRoundState> {
  const res = await api.get<JustStatRoundState>(`/games/just-stat/round/${roundId}`);
  return res.data;
}

export async function guessJustStat(
  roundId: string,
  guessValue: number,
): Promise<JustStatGuessResponse> {
  const res = await api.post<JustStatGuessResponse>('/games/just-stat/guess', {
    roundId,
    guessValue,
  });
  return res.data;
}

export async function timeoutJustStat(roundId: string): Promise<JustStatGuessResponse> {
  const res = await api.post<JustStatGuessResponse>('/games/just-stat/timeout', { roundId });
  return res.data;
}
