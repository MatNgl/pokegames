import { useEffect, useRef, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/auth-context';
import { changePasswordRequest } from '@/features/auth/auth-api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(8, 'Au moins 8 caractères'),
    confirm: z.string().min(1, 'Confirme le nouveau mot de passe'),
  })
  .refine((data) => data.newPassword === data.confirm, {
    path: ['confirm'],
    message: 'Les mots de passe ne correspondent pas',
  });

type PasswordValues = z.infer<typeof passwordSchema>;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, logout } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  // Fermeture au clavier (Echap) et focus initial sur la croix quand la modale s'ouvre.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit: SubmitHandler<PasswordValues> = async (values) => {
    setServerError(null);
    setSuccess(false);
    try {
      await changePasswordRequest(values.currentPassword, values.newPassword);
      setSuccess(true);
      reset();
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Impossible de changer le mot de passe'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-auto rounded-card border-4 border-border-strong bg-surface p-6 shadow-lg"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="settings-title" className="font-display text-sm leading-relaxed text-foreground">
            Paramètres
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-display text-[10px] uppercase tracking-widest text-muted">Compte</h3>

          {!user ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm font-semibold text-muted">
                Connecte-toi pour gérer ton compte.
              </p>
              <Link to="/connexion" onClick={onClose}>
                <Button size="sm" variant="go">
                  Se connecter
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 rounded-control border-2 border-border-strong bg-surface-2/60 px-3 py-2">
                <span className="text-sm font-extrabold text-foreground">{user.username}</span>
                <span className="text-xs font-semibold text-muted">{user.email}</span>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.currentPassword)}
                    aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
                    {...register('currentPassword')}
                  />
                  {errors.currentPassword && (
                    <p id="currentPassword-error" role="alert" className="text-xs text-danger">
                      {errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPassword)}
                    aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p id="newPassword-error" role="alert" className="text-xs text-danger">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm">Confirmer</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirm)}
                    aria-describedby={errors.confirm ? 'confirm-error' : undefined}
                    {...register('confirm')}
                  />
                  {errors.confirm && (
                    <p id="confirm-error" role="alert" className="text-xs text-danger">
                      {errors.confirm.message}
                    </p>
                  )}
                </div>

                {serverError && (
                  <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
                    {serverError}
                  </p>
                )}
                {success && (
                  <p role="status" className="rounded-control bg-go/10 px-3 py-2 text-sm font-semibold text-go-shadow">
                    Mot de passe mis à jour.
                  </p>
                )}

                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner className="h-4 w-4" /> : 'Changer le mot de passe'}
                </Button>
              </form>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void logout();
                  onClose();
                }}
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
