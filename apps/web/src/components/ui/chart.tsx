import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Enveloppe des graphiques (shadcn/ui Charts, batie sur Recharts) adaptee aux tokens du projet.
 * Recharts porte les axes, la grille, les infobulles et le responsive ; on ne garde ici que
 * l'habillage : hauteur, police et couleurs de la marque.
 */

/** Couleurs communes a tous les graphiques, alignees sur les tokens CSS. */
export const CHART_INK = '#2b2a24';
export const CHART_MUTED = '#6f6a52';
export const CHART_GRID = 'rgba(111,106,82,0.16)';
export const CHART_SURFACE = '#f7f3d7';

/** Axes et etiquettes : reglages passes tels quels aux composants Recharts. */
export const axisProps = {
  stroke: CHART_MUTED,
  tick: { fill: CHART_MUTED, fontSize: 11, fontWeight: 600 },
  tickLine: false,
  axisLine: { stroke: CHART_GRID },
} as const;

export function ChartContainer({
  height = 220,
  className,
  children,
}: {
  height?: number;
  className?: string;
  /** Un unique graphique Recharts (ResponsiveContainer n'accepte qu'un enfant). */
  children: ReactNode;
}) {
  return (
    <div className={cn('w-full text-xs font-semibold', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/**
 * Infobulle maison : la boite par defaut de Recharts est blanche et carree, elle jure avec les
 * cartes creme a bordure olive.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatValue?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-control border-2 border-border-strong bg-surface px-2.5 py-1.5 shadow-md">
      {label != null && label !== '' && (
        <p className="mb-1 text-[11px] font-bold text-foreground">{label}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry, i) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          const raw = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
          return (
            <li key={`${name}-${i}`} className="flex items-center gap-2 text-[11px]">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: entry.color ?? CHART_INK }}
              />
              <span className="text-muted">{name}</span>
              <span className="ml-auto font-bold tabular-nums text-foreground">
                {formatValue ? formatValue(raw, name) : raw}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
