import { api } from '@/lib/api';
import type {
  ShinyChoiceResponse,
  ShinyLevel,
  ShinyMode,
  ShinyRoundState,
} from '@pokegames/shared-types';

export async function startShiny(mode: ShinyMode, level: ShinyLevel): Promise<ShinyRoundState> {
  const res = await api.post<ShinyRoundState>('/games/shiny/start', { mode, level });
  return res.data;
}

export async function getShinyRound(roundId: string): Promise<ShinyRoundState> {
  const res = await api.get<ShinyRoundState>(`/games/shiny/round/${roundId}`);
  return res.data;
}

export async function submitShinyChoice(
  roundId: string,
  slot: number,
): Promise<ShinyChoiceResponse> {
  const res = await api.post<ShinyChoiceResponse>('/games/shiny/choice', { roundId, slot });
  return res.data;
}
