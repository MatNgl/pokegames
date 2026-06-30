import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border-4 border-border bg-surface shadow-[0_6px_0_rgba(63,93,29,0.25)]',
        className,
      )}
      {...props}
    />
  );
}
