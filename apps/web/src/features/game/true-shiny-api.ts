import { api } from '@/lib/api';
import type {
  TrueShinyChoiceResponse,
  TrueShinyLevel,
  TrueShinyRoundState,
} from '@pokegames/shared-types';

export async function startTrueShiny(level: TrueShinyLevel): Promise<TrueShinyRoundState> {
  const res = await api.post<TrueShinyRoundState>('/games/true-shiny/start', { level });
  return res.data;
}

export async function getTrueShinyRound(roundId: string): Promise<TrueShinyRoundState> {
  const res = await api.get<TrueShinyRoundState>(`/games/true-shiny/round/${roundId}`);
  return res.data;
}

export async function submitTrueShinyChoice(
  roundId: string,
  slot: number,
): Promise<TrueShinyChoiceResponse> {
  const res = await api.post<TrueShinyChoiceResponse>('/games/true-shiny/choice', { roundId, slot });
  return res.data;
}
