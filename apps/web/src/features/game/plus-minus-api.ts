import { api } from '@/lib/api';
import type { PlusMinusChoiceResponse, PlusMinusRoundState } from '@pokegames/shared-types';

export async function startPlusMinus(): Promise<PlusMinusRoundState> {
  const res = await api.post<PlusMinusRoundState>('/games/plus-minus/start', {});
  return res.data;
}

export async function getPlusMinusRound(roundId: string): Promise<PlusMinusRoundState> {
  const res = await api.get<PlusMinusRoundState>(`/games/plus-minus/round/${roundId}`);
  return res.data;
}

export async function submitPlusMinusChoice(
  roundId: string,
  choice: 'A' | 'B',
): Promise<PlusMinusChoiceResponse> {
  const res = await api.post<PlusMinusChoiceResponse>('/games/plus-minus/choice', { roundId, choice });
  return res.data;
}
