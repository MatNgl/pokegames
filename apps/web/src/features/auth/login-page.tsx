import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuth } from './auth-context';
import { loginSchema, type LoginValues } from './schemas';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/jouer';
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit: SubmitHandler<LoginValues> = async (values) => {
    setServerError(null);
    try {
      await login(values.emailOrUsername, values.password);
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Connexion impossible'));
    }
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <Logo className="text-2xl" />
            <p className="text-sm text-muted">Connectez-vous pour jouer et suivre vos scores.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emailOrUsername">Email ou nom d'utilisateur</Label>
              <Input
                id="emailOrUsername"
                autoComplete="username"
                aria-invalid={Boolean(errors.emailOrUsername)}
                aria-describedby={errors.emailOrUsername ? 'emailOrUsername-error' : undefined}
                {...register('emailOrUsername')}
              />
              {errors.emailOrUsername && (
                <p id="emailOrUsername-error" role="alert" className="text-xs text-danger">
                  {errors.emailOrUsername.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
                {serverError}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? <Spinner className="h-4 w-4" /> : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Pas encore de compte ?{' '}
            <Link to="/inscription" state={{ from }} className="text-primary hover:underline">
              Créer un compte
            </Link>
          </p>
        </Card>
      </div>
    </AppBackground>
  );
}
