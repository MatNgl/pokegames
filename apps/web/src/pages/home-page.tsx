import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

export function HomePage() {
  const { user } = useAuth();

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <Logo className="text-4xl" />
        <h1 className="mt-6 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Devine le Pokémon, bats ton meilleur score.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Des mini-jeux Pokémon rapides et nerveux. On commence par la silhouette à deviner.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/jouer">
            <Button size="lg">
              Jouer maintenant
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          {!user && (
            <Link to="/connexion">
              <Button size="lg" variant="secondary">
                Se connecter
              </Button>
            </Link>
          )}
        </div>
      </div>
    </AppBackground>
  );
}
