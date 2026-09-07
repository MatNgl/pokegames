import { api } from '@/lib/api';
import type { PokedexGuessResponse, PokedexRoundState } from '@pokegames/shared-types';

export async function startPokedexGame(): Promise<PokedexRoundState> {
  const res = await api.post<PokedexRoundState>('/games/pokedex/start');
  return res.data;
}

export async function getPokedexGameState(roundId: string): Promise<PokedexRoundState> {
  const res = await api.get<PokedexRoundState>(`/games/pokedex/round/${roundId}`);
  return res.data;
}

export async function submitPokedexGuess(
  roundId: string,
  name: string,
): Promise<PokedexGuessResponse> {
  const res = await api.post<PokedexGuessResponse>('/games/pokedex/guess', { roundId, name });
  return res.data;
}
