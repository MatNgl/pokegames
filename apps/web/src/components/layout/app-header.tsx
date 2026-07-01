import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { FolderKanbanIcon } from '@/components/ui/icons/folder-kanban-icon';
import { SettingsIcon } from '@/components/ui/icons/settings-icon';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer';

function getNextResetDiff(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return { hours, minutes, seconds };
}

function getClientId(): string {
  if (typeof window === 'undefined') return 'anon';
  let id = sessionStorage.getItem('pokegames_client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem('pokegames_client_id', id);
  }
  return id;
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const [timeLeft, setTimeLeft] = useState(getNextResetDiff);
  const [onlineCount, setOnlineCount] = useState<number>(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getNextResetDiff());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const cid = getClientId();
        const res = await api.get<{ count: number }>(`/users/online?clientId=${cid}`);
        if (typeof res.data?.count === 'number') {
          setOnlineCount(res.data.count);
        }
      } catch {
        // Ignorer en cas d'erreur de réseau
      }
    };

    void fetchOnline();
    const interval = setInterval(() => {
      void fetchOnline();
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const formattedTime = `${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/60 px-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex cursor-pointer items-center transition-opacity duration-200 hover:opacity-80"
          title="Retour à la sélection des jeux"
          aria-label="Retour à la sélection des jeux"
        >
          <Logo />
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className="flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm sm:px-3"
          title="Temps restant avant la réinitialisation des défis quotidiens (minuit UTC)"
        >
          
          <span className="hidden font-display text-[9px] uppercase text-muted md:inline">Reset</span>
          <span className="font-display text-[9px] text-primary sm:text-[10px]">{formattedTime}</span>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm sm:px-3"
          title="Joueurs actuellement en ligne"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-go"></span>
          </span>
          <span className="font-display text-[9px] text-foreground sm:text-[10px]">{onlineCount}</span>
          <span className="hidden font-display text-[8px] uppercase text-muted lg:inline">en ligne</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className={iconButtonClass} title="Pokédex (bientôt)" aria-label="Pokédex">
          <FolderKanbanIcon size={20} />
        </button>
        <button type="button" className={iconButtonClass} title="Paramètres (bientôt)" aria-label="Paramètres">
          <SettingsIcon size={20} />
        </button>
        {user ? (
          <div className="flex items-center gap-2 pl-2">
            <span className="hidden text-sm font-medium text-foreground sm:inline">{user.username}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className={iconButtonClass}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <Link to="/connexion" className="pl-1 sm:pl-2">
            <Button
              size="sm"
              variant="go"
              className="font-display text-[9px] uppercase tracking-wider shadow-[0_3px_0_var(--color-go-shadow)] sm:text-[10px]"
            >
              Connexion
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
