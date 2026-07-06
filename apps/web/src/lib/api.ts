import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './env';
import { getGuestIdentity } from './guest-identity';

// L'access token vit uniquement en memoire (jamais en localStorage), le refresh est un cookie httpOnly.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    // Joueur non connecte : on joint une identite invite stable pour apparaitre dans les
    // classements du jour. Le serveur ignore ces en-tetes des qu'un compte est authentifie.
    const guest = getGuestIdentity();
    config.headers.set('X-Guest-Id', guest.id);
    config.headers.set('X-Guest-Name', guest.name);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ accessToken: string }>(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(res.data.accessToken);
    return res.data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthRoute = original?.url?.includes('/auth/') ?? false;

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      refreshing ??= refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);
