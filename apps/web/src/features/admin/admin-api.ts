import { api } from '@/lib/api';
import type {
  AdminAuditLogEntry,
  AdminStats,
  AdminUserDetail,
  AdminUserSummary,
} from '@pokegames/shared-types';

export async function getAdminStats(): Promise<AdminStats> {
  const res = await api.get<AdminStats>('/admin/audit/stats');
  return res.data;
}

export async function getAdminAuditLogs(gameType?: string): Promise<AdminAuditLogEntry[]> {
  const res = await api.get<AdminAuditLogEntry[]>('/admin/audit/logs', {
    params: gameType ? { gameType, limit: 100 } : { limit: 100 },
  });
  return res.data;
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const res = await api.get<AdminUserSummary[]>('/admin/users');
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
