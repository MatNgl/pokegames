import { api } from '@/lib/api';
import type { UserDTO } from '@pokegames/shared-types';

export interface AuthSession {
  accessToken: string;
  user: UserDTO;
}

export async function loginRequest(emailOrUsername: string, password: string): Promise<AuthSession> {
  const res = await api.post<AuthSession>('/auth/login', { emailOrUsername, password });
  return res.data;
}

export async function registerRequest(
  email: string,
  username: string,
  password: string,
): Promise<UserDTO> {
  const res = await api.post<UserDTO>('/auth/register', { email, username, password });
  return res.data;
}

export async function refreshRequest(): Promise<AuthSession> {
  const res = await api.post<AuthSession>('/auth/refresh', {});
  return res.data;
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout', {});
}
