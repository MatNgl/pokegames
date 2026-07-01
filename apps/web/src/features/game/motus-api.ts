import { api } from '@/lib/api';
import type { MotusGuessResponse, MotusLevel, MotusRoundState } from '@pokegames/shared-types';

export async function startMotus(level: MotusLevel): Promise<MotusRoundState> {
  const res = await api.post<MotusRoundState>('/games/motus/start', { level });
  return res.data;
}

export async function getMotusRound(roundId: string): Promise<MotusRoundState> {
  const res = await api.get<MotusRoundState>(`/games/motus/round/${roundId}`);
  return res.data;
}

export async function submitMotusGuess(roundId: string, guess: string): Promise<MotusGuessResponse> {
  const res = await api.post<MotusGuessResponse>('/games/motus/guess', { roundId, guess });
  return res.data;
}
