import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuth } from './auth-context';
import { registerSchema, type RegisterValues } from './schemas';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit: SubmitHandler<RegisterValues> = async (values) => {
    setServerError(null);
    try {
      await registerUser(values.email, values.username, values.password);
      navigate('/jouer');
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Inscription impossible'));
    }
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <Logo className="text-2xl" />
            <p className="text-sm text-muted">Créez votre compte pour commencer à jouer.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input id="username" autoComplete="username" {...register('username')} />
              {errors.username && <p className="text-xs text-danger">{errors.username.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register('confirm')}
              />
              {errors.confirm && <p className="text-xs text-danger">{errors.confirm.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? <Spinner className="h-4 w-4" /> : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </Card>
      </div>
    </AppBackground>
  );
}
