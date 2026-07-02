import { api } from '@/lib/api';
import type {
  AdminAuditLogEntry,
  AdminGameConfigEntry,
  AdminPage,
  AdminStats,
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

export async function getAdminStats(): Promise<AdminStats> {
  const res = await api.get<AdminStats>('/admin/audit/stats');
  return res.data;
}

export async function getAdminAuditLogs(page = 1): Promise<AdminPage<AdminAuditLogEntry>> {
  const res = await api.get<AdminPage<AdminAuditLogEntry>>('/admin/audit/logs', { params: { page } });
  return res.data;
}

export async function getAdminUsers(page = 1): Promise<AdminPage<AdminUserSummary>> {
  const res = await api.get<AdminPage<AdminUserSummary>>('/admin/users', { params: { page } });
  return res.data;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return res.data;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
