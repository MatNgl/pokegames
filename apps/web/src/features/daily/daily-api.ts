import { api } from '@/lib/api';
import type { DailyStatusResponse } from '@pokegames/shared-types';

export async function getDailyStatus(): Promise<DailyStatusResponse> {
  const res = await api.get<DailyStatusResponse>('/daily/status');
  return res.data;
}

export async function getDailyHistory(limit = 60): Promise<DailyStatusResponse> {
  const res = await api.get<DailyStatusResponse>(`/daily/history?limit=${limit}`);
  return res.data;
}
