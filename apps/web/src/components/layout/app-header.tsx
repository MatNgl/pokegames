import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { History, ListChecks, LogOut, Menu, Shield, Trophy, X } from 'lucide-react';
import { FolderKanbanIcon } from '@/components/ui/icons/folder-kanban-icon';
import { SettingsIcon } from '@/components/ui/icons/settings-icon';
import { SettingsModal } from '@/features/settings/settings-modal';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

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
  const location = useLocation();
  const loginState = { from: location.pathname + location.search };
  const [timeLeft, setTimeLeft] = useState(getNextResetDiff);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

      <div className="hidden items-center gap-2 sm:gap-3 md:flex">
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

      {/* Barre d'actions en ligne (tablette et desktop) */}
      <div className="hidden items-center gap-1 md:flex">
        <Link to="/quetes" className={iconButtonClass} title="Quêtes du jour" aria-label="Quêtes du jour">
          <ListChecks className="h-5 w-5" />
        </Link>
        <Link to="/classements" className={iconButtonClass} title="Classements" aria-label="Classements">
          <Trophy className="h-5 w-5" />
        </Link>
        <Link to="/historique" className={iconButtonClass} title="Mon historique" aria-label="Mon historique">
          <History className="h-5 w-5" />
        </Link>
        <button type="button" className={iconButtonClass} title="Pokédex (bientôt)" aria-label="Pokédex">
          <FolderKanbanIcon size={20} />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={iconButtonClass}
          title="Paramètres"
          aria-label="Paramètres"
        >
          <SettingsIcon size={20} />
        </button>
        {user?.role === 'ADMIN' && (
          <Link to="/admin" className={iconButtonClass} title="Administration" aria-label="Administration">
            <Shield className="h-5 w-5" />
          </Link>
        )}
        {user ? (
          <div className="flex items-center gap-2 pl-2">
            <span className="text-sm font-medium text-foreground">{user.username}</span>
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
          <Link to="/connexion" state={loginState} className="pl-1 sm:pl-2">
            <Button
              size="sm"
              variant="go"
              className="font-display text-[10px] uppercase tracking-wider shadow-[0_3px_0_var(--color-go-shadow)]"
            >
              Connexion
            </Button>
          </Link>
        )}
      </div>

      {/* Menu burger (mobile) */}
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={iconButtonClass}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div className="absolute right-0 top-12 z-40 flex w-56 flex-col gap-1 rounded-card border-4 border-border bg-surface p-2 shadow-[0_6px_0_rgba(63,93,29,0.25)]">
              {user && (
                <p className="px-2 py-1 text-sm font-bold text-foreground">{user.username}</p>
              )}
              <div className="mb-1 flex items-center justify-between gap-2 border-b border-border px-2 pb-2">
                <span className="flex items-center gap-1 font-display text-[9px] text-muted">
                  Reset <span className="text-primary">{formattedTime}</span>
                </span>
                <span className="flex items-center gap-1 font-display text-[9px] text-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-go"></span>
                  </span>
                  {onlineCount}
                </span>
              </div>
              <Link
                to="/quetes"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                <ListChecks className="h-4 w-4" /> Quêtes du jour
              </Link>
              <Link
                to="/classements"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                <Trophy className="h-4 w-4" /> Classements
              </Link>
              <Link
                to="/historique"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                <History className="h-4 w-4" /> Mon historique
              </Link>
              <span className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold text-muted/60">
                <FolderKanbanIcon size={16} /> Pokédex (bientôt)
              </span>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex items-center gap-2 rounded-control px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-2"
              >
                <SettingsIcon size={16} /> Paramètres
              </button>
              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
                >
                  <Shield className="h-4 w-4" /> Administration
                </Link>
              )}
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="flex items-center gap-2 rounded-control px-2 py-2 text-left text-sm font-semibold text-danger hover:bg-surface-2"
                >
                  <LogOut className="h-4 w-4" /> Se déconnecter
                </button>
              ) : (
                <Link
                  to="/connexion"
                  state={loginState}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-control px-2 py-2 text-sm font-bold text-go hover:bg-surface-2"
                >
                  Connexion
                </Link>
              )}
            </div>
          </>
        )}
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
