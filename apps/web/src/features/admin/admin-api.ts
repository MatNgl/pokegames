import { api } from '@/lib/api';
import type {
  AdminAnomaly,
  AdminAuditLogEntry,
  AdminConfigLogEntry,
  AdminEtlStatus,
  AdminGameConfigEntry,
  AdminGamesReport,
  AdminOverview,
  AdminPage,
  AdminPokedexReport,
  AdminRetentionReport,
  AdminStats,
  AdminSystemInfo,
  AdminUserDetail,
  AdminUserSummary,
} from '@pokegames/shared-types';

export async function getGameConfigs(): Promise<AdminGameConfigEntry[]> {
  const res = await api.get<AdminGameConfigEntry[]>('/admin/games/config');
  return res.data;
}

export async function updateGameConfig(key: string, value: unknown): Promise<void> {
  await api.put(`/admin/games/config/${key}`, { value });
}

export async function getGameConfigDefaults(): Promise<AdminGameConfigEntry[]> {
  const res = await api.get<AdminGameConfigEntry[]>('/admin/games/config/defaults');
  return res.data;
}

export async function resetGameConfig(key: string): Promise<unknown> {
  const res = await api.post<{ value: unknown }>(`/admin/games/config/${key}/reset`);
  return res.data.value;
}

export async function getGameConfigLogs(): Promise<AdminConfigLogEntry[]> {
  const res = await api.get<AdminConfigLogEntry[]>('/admin/games/config/logs');
  return res.data;
}

export async function getEtlStatus(): Promise<AdminEtlStatus> {
  const res = await api.get<AdminEtlStatus>('/admin/system/etl');
  return res.data;
}

export async function startEtl(): Promise<AdminEtlStatus> {
  const res = await api.post<AdminEtlStatus>('/admin/system/etl');
  return res.data;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await api.get<AdminStats>('/admin/audit/stats');
  return res.data;
}

export async function getAdminAuditLogs(
  page = 1,
  gameType?: string,
  outcome?: string,
): Promise<AdminPage<AdminAuditLogEntry>> {
  const res = await api.get<AdminPage<AdminAuditLogEntry>>('/admin/audit/logs', {
    params: { page, ...(gameType ? { gameType } : {}), ...(outcome ? { outcome } : {}) },
  });
  return res.data;
}

export async function getAdminAnomalies(): Promise<AdminAnomaly[]> {
  const res = await api.get<AdminAnomaly[]>('/admin/audit/anomalies');
  return res.data;
}

export async function getAdminUsers(
  page = 1,
  q?: string,
  sort?: string,
): Promise<AdminPage<AdminUserSummary>> {
  const res = await api.get<AdminPage<AdminUserSummary>>('/admin/users', {
    params: { page, ...(q ? { q } : {}), ...(sort ? { sort } : {}) },
  });
  return res.data;
}

export async function getAdminOverview(days: number): Promise<AdminOverview> {
  const res = await api.get<AdminOverview>('/admin/audit/overview', { params: { days } });
  return res.data;
}

export async function getAdminGamesReport(days: number): Promise<AdminGamesReport> {
  const res = await api.get<AdminGamesReport>('/admin/audit/games', { params: { days } });
  return res.data;
}

export async function getAdminRetention(): Promise<AdminRetentionReport> {
  const res = await api.get<AdminRetentionReport>('/admin/audit/retention');
  return res.data;
}

export async function getAdminPokedexReport(): Promise<AdminPokedexReport> {
  const res = await api.get<AdminPokedexReport>('/admin/audit/pokedex');
  return res.data;
}

export async function getAdminSystemInfo(): Promise<AdminSystemInfo> {
  const res = await api.get<AdminSystemInfo>('/admin/audit/system');
  return res.data;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return res.data;
}

export async function updateAdminUserRole(id: string, role: 'USER' | 'ADMIN'): Promise<void> {
  await api.patch(`/admin/users/${id}/role`, { role });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`);
}

export async function resetAdminUserDaily(id: string): Promise<number> {
  const res = await api.post<{ deleted: number }>(`/admin/users/${id}/reset-daily`, {});
  return res.data.deleted;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
