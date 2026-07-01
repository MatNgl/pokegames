import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-base (16px) sur mobile empeche le zoom auto d'iOS a la saisie ; text-sm sur desktop.
        'h-11 w-full rounded-control border-2 border-border-strong bg-white px-3 text-base font-medium text-foreground transition-colors duration-200 placeholder:text-muted/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 sm:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
