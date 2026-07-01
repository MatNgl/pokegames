import { api } from '@/lib/api';
import type {
  IntruderChoiceResponse,
  IntruderLevel,
  IntruderRoundState,
} from '@pokegames/shared-types';

export async function startIntruder(level: IntruderLevel): Promise<IntruderRoundState> {
  const res = await api.post<IntruderRoundState>('/games/intruder/start', { level });
  return res.data;
}

export async function getIntruderRound(roundId: string): Promise<IntruderRoundState> {
  const res = await api.get<IntruderRoundState>(`/games/intruder/round/${roundId}`);
  return res.data;
}

export async function submitIntruderChoice(
  roundId: string,
  pokemonId: number,
): Promise<IntruderChoiceResponse> {
  const res = await api.post<IntruderChoiceResponse>('/games/intruder/choice', {
    roundId,
    pokemonId,
  });
  return res.data;
}
