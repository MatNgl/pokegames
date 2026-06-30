import { z } from 'zod';

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email('Adresse email invalide'),
    username: z
      .string()
      .min(3, 'Au moins 3 caractères')
      .max(20, 'Au plus 20 caractères'),
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
