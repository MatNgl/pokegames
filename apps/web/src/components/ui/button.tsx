import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-control font-bold uppercase tracking-wide cursor-pointer transition-[filter,transform] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5',
  {
    variants: {
      variant: {
        primary: 'border-b-4 border-primary-shadow bg-primary text-primary-foreground hover:brightness-110',
        go: 'border-b-4 border-go-shadow bg-go text-go-foreground hover:brightness-110',
        secondary: 'border-2 border-border-strong bg-surface text-foreground hover:bg-surface-2',
        danger: 'border-b-4 border-[#a40f0f] bg-danger text-white hover:brightness-110',
        ghost: 'text-foreground hover:bg-black/5',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
