import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { FolderKanbanIcon } from '@/components/ui/icons/folder-kanban-icon';
import { SettingsIcon } from '@/components/ui/icons/settings-icon';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer';

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/60 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="flex cursor-pointer items-center transition-opacity duration-200 hover:opacity-80"
          title="Retour à la sélection des jeux"
          aria-label="Retour à la sélection des jeux"
        >
          <Logo />
        </Link>
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
          <Link to="/connexion" className="pl-2">
            <Button size="sm" variant="secondary">
              Connexion
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

