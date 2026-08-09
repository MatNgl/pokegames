import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  TableHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Primitives de tableau (shadcn/ui, retouchees aux tokens du projet : surfaces creme, bordures
 * olive). Un tableau reste la forme la plus lisible des qu'une ligne porte plus de deux chiffres :
 * les colonnes s'alignent, l'oeil compare verticalement.
 */

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b-2 [&_tr]:border-border-strong', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t-2 border-border-strong bg-surface-2/60 font-bold', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border/40 transition-colors hover:bg-surface-2/60',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-9 whitespace-nowrap px-2 text-left align-middle text-[11px] font-bold uppercase tracking-wide text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-2 py-1.5 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-2 text-xs font-semibold text-muted', className)} {...props} />;
}

/**
 * En-tete de colonne cliquable. Le tri est indispensable des qu'un tableau depasse cinq lignes :
 * sans lui, on ne peut pas repondir a "quel est le pire ?" sans lire toute la colonne.
 */
export function SortableHead({
  label,
  active,
  direction,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={cn('p-0', className)}>
      <button
        type="button"
        onClick={onClick}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'flex h-9 w-full items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          active ? 'text-foreground' : 'text-muted hover:text-foreground',
        )}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden="true" className={cn('text-[9px]', active ? 'opacity-100' : 'opacity-30')}>
          {active && direction === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </TableHead>
  );
}

/** Jauge compacte posee dans une cellule : donne la comparaison visuelle sans quitter le tableau. */
export function CellMeter({ value, color }: { value: number; color?: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-primary/15 sm:w-20">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color ?? '#3b4cca' }}
        />
      </span>
      <span className="shrink-0 tabular-nums">{value}%</span>
    </span>
  );
}
