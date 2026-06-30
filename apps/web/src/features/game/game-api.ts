import { api } from '@/lib/api';
import type {
  WhoIsItConfig,
  WhoIsItGuessResponse,
  WhoIsItHintType,
  WhoIsItRoundState,
} from '@pokegames/shared-types';

export async function startRound(config: Partial<WhoIsItConfig>): Promise<WhoIsItRoundState> {
  const res = await api.post<WhoIsItRoundState>('/games/who-is-it/start', config);
  return res.data;
}

export async function requestHint(
  roundId: string,
  hintType: WhoIsItHintType,
): Promise<WhoIsItRoundState> {
  const res = await api.post<WhoIsItRoundState>('/games/who-is-it/hint', { roundId, hintType });
  return res.data;
}

export async function submitGuess(roundId: string, guess: string): Promise<WhoIsItGuessResponse> {
  const res = await api.post<WhoIsItGuessResponse>('/games/who-is-it/guess', { roundId, guess });
  return res.data;
}

export async function getRoundState(roundId: string): Promise<WhoIsItRoundState> {
  const res = await api.get<WhoIsItRoundState>(`/games/who-is-it/round/${roundId}`);
  return res.data;
}

export async function getPokemonNames(): Promise<string[]> {
  const res = await api.get<string[]>('/pokemon/names');
  return res.data;
}
