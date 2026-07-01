import { api } from '@/lib/api';
import type { DailyStatusResponse, LeaderboardResponse } from '@pokegames/shared-types';

export async function getDailyStatus(): Promise<DailyStatusResponse> {
  const res = await api.get<DailyStatusResponse>('/daily/status');
  return res.data;
}

export async function getDailyHistory(limit = 60): Promise<DailyStatusResponse> {
  const res = await api.get<DailyStatusResponse>(`/daily/history?limit=${limit}`);
  return res.data;
}

export async function getLeaderboard(game: string, scope: string): Promise<LeaderboardResponse> {
  const res = await api.get<LeaderboardResponse>('/daily/leaderboard', {
    params: { game, scope },
  });
  return res.data;
}
