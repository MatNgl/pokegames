import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Graphiques SVG ecrits a la main : aucune librairie ajoutee (le bundle est deja lourd et une lib
 * imposerait son esthetique). Quatre formes suffisent a tout l'admin : courbe, camembert, barres
 * horizontales et histogramme.
 *
 * Regles communes : marques fines, grille discrete, valeurs toujours lisibles en clair, et
 * infobulle au survol plutot qu'une etiquette sur chaque point.
 */

const INK = '#2b2a24';
const MUTED = '#6f6a52';
const GRID = 'rgba(111,106,82,0.18)';

/** Palette de l'admin : teintes franchement distinctes, une par jeu. */
export const CHART_COLORS = [
  '#3b4cca', // bleu
  '#5fb24a', // vert
  '#e8730c', // orange
  '#c2185b', // framboise
  '#00897b', // sarcelle
  '#f9a825', // ambre
  '#6a4ca0', // violet
  '#0277bd', // bleu clair
  '#8d6e63', // brun
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]!;
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="py-8 text-center text-sm font-semibold text-muted">{label}</p>
  );
}

/* ------------------------------------------------------------------ Courbe */

export interface LineSeries {
  label: string;
  color: string;
  points: { x: string; y: number }[];
}

/**
 * Courbe temporelle multi-series. L'axe X est categoriel (un pas par jour) : on n'affiche qu'une
 * poignee de dates, sinon les etiquettes se chevauchent.
 */
export function LineChart({
  series,
  height = 200,
  formatValue = (v: number) => String(v),
}: {
  series: LineSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();
  const first = series[0];
  if (!first || first.points.length === 0) return <EmptyState label="Pas encore de données." />;

  const n = first.points.length;
  const w = 640;
  const padL = 34;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const xAt = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  // 4 graduations horizontales, valeurs entieres.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        style={{ minWidth: 320 }}
        role="img"
        aria-label={`Courbe : ${series.map((s) => s.label).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={padL} y={padT} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {[...new Set(ticks)].map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={yAt(t)} y2={yAt(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={yAt(t) + 4} textAnchor="end" fontSize={10} fill={MUTED}>
              {t}
            </text>
          </g>
        ))}

        {first.points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.x} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={MUTED}>
              {p.x.slice(5)}
            </text>
          ) : null,
        )}

        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => (
            <polyline
              key={s.label}
              points={s.points.map((p, i) => `${xAt(i)},${yAt(p.y)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </g>

        {hover !== null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + innerH} stroke={MUTED} strokeWidth={1} />
        )}
        {hover !== null &&
          series.map((s) => {
            const p = s.points[hover];
            return p ? <circle key={s.label} cx={xAt(hover)} cy={yAt(p.y)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} /> : null;
          })}

        {/* Zones de survol : plus larges que les points, pour viser facilement */}
        {first.points.map((p, i) => (
          <rect
            key={p.x}
            x={xAt(i) - innerW / n / 2}
            y={padT}
            width={innerW / n}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
            {hover !== null && (
              <span className="font-bold text-foreground">
                {formatValue(s.points[hover]?.y ?? 0)}
              </span>
            )}
          </span>
        ))}
        {hover !== null && (
          <span className="text-xs font-semibold text-foreground">{first.points[hover]?.x}</span>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Camembert */

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

/** Camembert avec legende chiffree : la part exacte est toujours ecrite, jamais devinee. */
export function PieChart({ slices, size = 190 }: { slices: PieSlice[]; size?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <EmptyState label="Pas encore de parties." />;

  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2; // demarre en haut

  const paths = slices.map((s) => {
    const share = s.value / total;
    const sweep = share * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    // Une part unique fait un cercle complet : l'arc degenere, on trace un disque.
    const d =
      share >= 0.999
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, slice: s, pct: Math.round(share * 100) };
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Répartition : ${slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}
      >
        {paths.map(({ d, slice }) => (
          <path
            key={slice.label}
            d={d}
            fill={slice.color}
            stroke="#f7f3d7"
            strokeWidth={2}
            opacity={hover && hover !== slice.label ? 0.45 : 1}
            onMouseEnter={() => setHover(slice.label)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      <ul className="flex min-w-40 flex-col gap-1">
        {paths.map(({ slice, pct }) => (
          <li
            key={slice.label}
            onMouseEnter={() => setHover(slice.label)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-control px-1.5 py-0.5 text-xs transition-colors',
              hover === slice.label && 'bg-surface-2',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate font-semibold text-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-muted">
              {slice.value} · {pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------- Barres et jauges */

export interface BarRow {
  label: string;
  value: number;
  color?: string;
  hint?: ReactNode;
}

/** Barres horizontales : la forme la plus lisible pour comparer des categories nommees. */
export function BarChart({
  rows,
  max,
  formatValue = (v: number) => String(v),
}: {
  rows: BarRow[];
  max?: number;
  formatValue?: (v: number) => string;
}) {
  if (rows.length === 0) return <EmptyState label="Pas encore de données." />;
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-bold text-foreground">{r.label}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
              {r.hint ?? formatValue(r.value)}
            </span>
          </div>
          <span className="block h-2 w-full overflow-hidden rounded-full bg-primary/15">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(r.value / top) * 100}%`, background: r.color ?? '#3b4cca' }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Histogramme */

/** Histogramme vertical : distribution d'une variable entiere (essais, jours joues). */
export function Histogram({
  buckets,
  xLabel,
  height = 130,
}: {
  buckets: { label: string | number; count: number }[];
  xLabel?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (buckets.length === 0) return <EmptyState label="Pas encore de données." />;
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-1" style={{ height }}>
        {buckets.map((b, i) => (
          <div
            key={b.label}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-[10px] font-bold tabular-nums text-foreground">
              {hover === i ? b.count : ''}
            </span>
            <span
              className="w-full rounded-t-[4px] bg-primary transition-opacity"
              style={{
                height: `${Math.max(2, (b.count / max) * (height - 18))}px`,
                opacity: hover === null || hover === i ? 1 : 0.5,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {buckets.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 text-center text-[10px] font-semibold text-muted">
            {b.label}
          </span>
        ))}
      </div>
      {xLabel && <p className="text-center text-[10px] font-semibold text-muted/70">{xLabel}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Cohortes */

/** Tableau de cohortes : intensite de couleur proportionnelle a la retention. */
export function CohortTable({
  cohorts,
}: {
  cohorts: { week: string; size: number; retentionPct: (number | null)[] }[];
}) {
  if (cohorts.length === 0) return <EmptyState label="Pas encore de cohortes." />;
  const weeks = cohorts[0]?.retentionPct.length ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left font-semibold text-muted">Semaine</th>
            <th className="p-1 text-right font-semibold text-muted">Inscrits</th>
            {Array.from({ length: weeks }, (_, k) => (
              <th key={k} className="p-1 text-center font-semibold text-muted">
                S{k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.week}>
              <td className="whitespace-nowrap p-1 font-semibold text-foreground">{c.week}</td>
              <td className="p-1 text-right font-bold tabular-nums text-foreground">{c.size}</td>
              {c.retentionPct.map((v, k) => (
                <td
                  key={k}
                  className="rounded p-1 text-center font-bold tabular-nums"
                  style={
                    v === null
                      ? { color: MUTED }
                      : { background: `rgba(59,76,202,${0.08 + (v / 100) * 0.6})`, color: v > 60 ? '#fff' : INK }
                  }
                >
                  {v === null ? '·' : `${v}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
