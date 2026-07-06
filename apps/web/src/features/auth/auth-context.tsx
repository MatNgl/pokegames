import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@pokegames/shared-types';
import { setAccessToken } from '@/lib/api';
import { clearGuestIdentity } from '@/lib/guest-identity';
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
    .catch((error: unknown) => {
      setAccessToken(null);
      // Echec reseau (API injoignable, aucune reponse HTTP) : on ne memorise pas l'echec, afin de
      // pouvoir reessayer des que l'API redevient joignable, sans imposer un rechargement complet de
      // la page. Un vrai refus (401 : pas de session) reste memorise, l'utilisateur est un invite.
      if (axios.isAxiosError(error) && !error.response) {
        bootstrapPromise = null;
      }
      return null;
    });
  return bootstrapPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

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

  // Reprise apres un echec reseau au demarrage : tant qu'aucune session n'est restauree et que la
  // derniere tentative etait un echec reseau (bootstrapPromise remis a null), on reessaye en
  // arriere-plan avec un delai croissant. S'arrete des qu'une session revient ou qu'un refus 401 ferme
  // le cas (invite legitime, bootstrapPromise conserve). Corrige le cas "connecte mais vu invite" quand
  // l'API etait injoignable au chargement, sans devoir rafraichir la page.
  useEffect(() => {
    if (initializing || user || bootstrapPromise !== null) return;
    let active = true;
    let delay = 2000;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      void bootstrapSession().then((restored) => {
        if (!active) return;
        if (restored) {
          setUser(restored);
          return;
        }
        if (bootstrapPromise === null) {
          delay = Math.min(Math.round(delay * 1.5), 15000);
          timer = setTimeout(attempt, delay);
        }
      });
    };
    timer = setTimeout(attempt, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [initializing, user]);

  const login = useCallback(
    async (emailOrUsername: string, password: string) => {
      // L'intercepteur joint l'en-tete X-Guest-Id a cette requete : le serveur rattache au compte
      // les scores joues en invite. On efface ensuite l'identite invite locale et on invalide les
      // requetes en cache (classements, statut du jour) pour qu'elles refletent le compte connecte.
      const session = await loginRequest(emailOrUsername, password);
      setAccessToken(session.accessToken);
      setUser(session.user);
      clearGuestIdentity();
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      // L'intercepteur joint l'en-tete X-Guest-Id a cette requete non authentifiee : le serveur
      // rattache les scores invites au compte cree. La connexion qui suit efface l'identite invite.
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
