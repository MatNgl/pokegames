import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}
