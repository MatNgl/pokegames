import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDTO } from '@pokegames/shared-types';
import { setAccessToken } from '@/lib/api';
import { loginRequest, logoutRequest, refreshRequest, registerRequest } from './auth-api';

interface AuthContextValue {
  user: UserDTO | null;
  initializing: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Restauration de session dedoublonnee : partagee entre les deux montages de React StrictMode
// (le refresh token est a usage unique cote serveur, deux appels concurrents en invalideraient un).
let bootstrapPromise: Promise<UserDTO | null> | null = null;
function bootstrapSession(): Promise<UserDTO | null> {
  bootstrapPromise ??= refreshRequest()
    .then((session) => {
      setAccessToken(session.accessToken);
      return session.user;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    });
  return bootstrapPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    // Restauration de session via le cookie refresh httpOnly au premier chargement (une seule requete).
    void bootstrapSession().then((restored) => {
      if (!active) return;
      setUser(restored);
      setInitializing(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const session = await loginRequest(emailOrUsername, password);
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      await registerRequest(email, username, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit etre utilise a l'interieur de AuthProvider");
  }
  return ctx;
}
