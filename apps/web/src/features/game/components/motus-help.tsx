import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEGEND: { className: string; label: string }[] = [
  { className: 'border-go-shadow bg-go text-white', label: 'Bien placée' },
  { className: 'border-accent-shadow bg-accent text-foreground', label: 'Présente, mal placée' },
  { className: 'border-absent-shadow bg-absent text-surface', label: 'Absente du mot' },
];

// Bouton "?" + popover expliquant les regles du Poke-Motus en quelques lignes.
export function MotusHelp() {
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
        aria-label="Règles du jeu"
        aria-expanded={open}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
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
            aria-label="Règles du Poké-Motus"
            className="absolute right-0 top-11 z-20 w-72 rounded-card border-4 border-border bg-surface p-4 text-left shadow-[0_6px_0_rgba(63,93,29,0.25)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-[11px] uppercase text-foreground">Règles</h2>
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
              <li>Devine le Pokémon du jour en 6 essais.</li>
              <li>La première lettre est donnée.</li>
              <li>Chaque proposition doit être un vrai Pokémon de la même longueur.</li>
              <li>La ligne se valide automatiquement une fois pleine.</li>
            </ul>
            <div className="mt-3 space-y-1.5">
              {LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded border-2 font-display text-[10px]',
                      item.className,
                    )}
                  >
                    A
                  </span>
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
