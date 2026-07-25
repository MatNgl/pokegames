import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HelpLegendItem {
  className: string;
  label: string;
  glyph?: string;
}

interface HelpPopoverProps {
  rules: string[];
  legend?: HelpLegendItem[];
  title?: string;
  ariaLabel?: string;
}

// Bouton "?" + popover expliquant les regles d'un jeu en quelques lignes. Reutilisable.
export function HelpPopover({ rules, legend, title = 'Règles', ariaLabel = 'Règles du jeu' }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="dialog"
            aria-label={ariaLabel}
            className="absolute right-0 top-11 z-20 w-72 rounded-card border-4 border-border bg-surface p-4 text-left shadow-[0_6px_0_rgba(63,93,29,0.25)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-[11px] uppercase text-foreground">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="cursor-pointer rounded p-1 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1.5 text-sm font-semibold text-muted">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            {legend && legend.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {legend.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded border-2 font-display text-[10px]',
                        item.className,
                      )}
                    >
                      {item.glyph ?? 'A'}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
