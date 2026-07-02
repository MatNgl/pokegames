import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ArenaInstructionProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Consigne d'une manche, commune aux jeux a cases : petit bandeau centre, discret et lisible.
export function ArenaInstruction({ icon, children, className }: ArenaInstructionProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 border-border-strong/40 bg-surface-2/60 px-3.5 py-1.5',
        className,
      )}
    >
      {icon}
      <span className="font-display text-[10px] uppercase tracking-wide text-foreground">
        {children}
      </span>
    </div>
  );
}
