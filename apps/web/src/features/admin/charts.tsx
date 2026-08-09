import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RcBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RcLineChart,
  Pie,
  PieChart as RcPieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_GRID,
  CHART_INK,
  CHART_MUTED,
  CHART_SURFACE,
  ChartContainer,
  ChartTooltipContent,
  axisProps,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

/**
 * Graphiques de l'admin, batis sur Recharts (la brique des Charts shadcn/ui). Recharts apporte
 * axes, grille, infobulles et responsive ; on ne definit ici que les formes utiles a ce tableau
 * de bord et l'habillage aux couleurs de la marque.
 *
 * La route /admin est chargee en differe : cette dependance ne pese jamais sur le bundle des jeux.
 */

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

/** Date d'axe abregee : "4 juil." tient sous une graduation, pas "2026-07-04". */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Etat vide explicite. Sans ce message, une periode sans activite est indiscernable d'un bug :
 * on dit donc ce qui manque, et quoi faire.
 */
export function EmptyState({
  label,
  hint,
  action,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="text-xs font-semibold text-muted/70">
        {hint ?? 'Élargis la période en haut de page pour remonter plus loin.'}
      </p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Courbe */

export interface LineSeries {
  label: string;
  color: string;
  points: { x: string; y: number }[];
}

/**
 * Courbe temporelle multi-series, en aires empilees visuellement (aire translucide sous la
 * courbe) : le volume se lit d'un coup d'oeil, la valeur exacte au survol.
 */
export function LineChart({ series, height = 220 }: { series: LineSeries[]; height?: number }) {
  const first = series[0];
  if (!first || first.points.length === 0) return <EmptyState label="Pas encore de données." />;

  const allZero = series.every((s) => s.points.every((p) => p.y === 0));
  if (allZero) {
    return <EmptyState label="Aucune activité sur cette période." />;
  }

  // Recharts consomme une ligne par pas de temps : { x, "Parties": 3, "Joueurs": 1 }.
  const data = first.points.map((p, i) => {
    const row: Record<string, string | number> = { x: p.x, label: shortDate(p.x) };
    for (const s of series) row[s.label] = s.points[i]?.y ?? 0;
    return row;
  });

  // Au-dela d'un mois, une graduation sur deux suffit : sinon les dates se chevauchent.
  const interval = data.length > 60 ? 9 : data.length > 30 ? 4 : data.length > 14 ? 2 : 0;

  return (
    <ChartContainer height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.label} id={`fill-${s.label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" interval={interval} {...axisProps} />
        <YAxis allowDecimals={false} width={40} {...axisProps} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: CHART_MUTED, strokeWidth: 1 }} />
        {series.length > 1 && (
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, fontWeight: 700, color: CHART_MUTED }}
          />
        )}
        {series.map((s) => (
          <Area
            key={s.label}
            type="monotone"
            dataKey={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#fill-${s.label})`}
            dot={false}
            activeDot={{ r: 4, stroke: CHART_SURFACE, strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/** Variante sans remplissage, pour une serie secondaire (inscriptions) posee dans une carte etroite. */
export function SparkLine({ series, height = 160 }: { series: LineSeries[]; height?: number }) {
  const first = series[0];
  if (!first || first.points.length === 0) return <EmptyState label="Pas encore de données." />;
  if (series.every((s) => s.points.every((p) => p.y === 0))) {
    return <EmptyState label="Aucune inscription sur cette période." />;
  }

  const data = first.points.map((p, i) => {
    const row: Record<string, string | number> = { label: shortDate(p.x) };
    for (const s of series) row[s.label] = s.points[i]?.y ?? 0;
    return row;
  });
  const interval = data.length > 60 ? 9 : data.length > 30 ? 4 : data.length > 14 ? 2 : 0;

  return (
    <ChartContainer height={height}>
      <RcLineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" interval={interval} {...axisProps} />
        <YAxis allowDecimals={false} width={40} {...axisProps} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: CHART_MUTED, strokeWidth: 1 }} />
        {series.map((s) => (
          <Line
            key={s.label}
            type="monotone"
            dataKey={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: CHART_SURFACE, strokeWidth: 2 }}
          />
        ))}
      </RcLineChart>
    </ChartContainer>
  );
}

/* --------------------------------------------------------------- Camembert */

export interface PieSlice {
  label: string;
  value: number;
  color: string;
  icon?: ReactNode;
}

/**
 * Camembert avec legende chiffree : la part exacte est toujours ecrite, jamais devinee a l'oeil.
 * Anneau plutot que disque plein, le total au centre sert de repere.
 */
export function PieChart({ slices, height = 210 }: { slices: PieSlice[]; height?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <EmptyState label="Aucune partie sur cette période." />;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative" style={{ width: height, height }}>
        <ChartContainer height={height}>
          <RcPieChart>
            <Tooltip
              content={
                <ChartTooltipContent
                  formatValue={(v) => `${v} · ${Math.round((v / total) * 100)}%`}
                />
              }
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </RcPieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold leading-none text-foreground">{total}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">parties</span>
        </div>
      </div>

      <ul className="flex min-w-40 flex-1 flex-col gap-0.5">
        {slices.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3 rounded-control px-1.5 py-1 text-xs hover:bg-surface-2"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              {s.icon}
              <span className="truncate font-semibold text-foreground">{s.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-muted">
              {s.value} · {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------- Barres et jauges */

export interface BarRow {
  /** Identifiant stable de la ligne (cle React) ; le libelle peut etre du contenu riche. */
  key?: string;
  label: ReactNode;
  value: number;
  color?: string;
  hint?: ReactNode;
}

/**
 * Barres horizontales en HTML (pas en SVG) : le libelle peut alors contenir une vignette de jeu
 * et rester tronque proprement. Reserve aux listes courtes ; au-dela, un tableau est plus lisible.
 */
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
      {rows.map((r, i) => (
        <div key={r.key ?? i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
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
  height = 160,
  color = '#3b4cca',
}: {
  buckets: { label: string | number; count: number }[];
  xLabel?: string;
  height?: number;
  color?: string;
}) {
  if (buckets.length === 0) return <EmptyState label="Pas encore de données." />;
  const data = buckets.map((b) => ({ label: String(b.label), count: b.count }));

  return (
    <div className="flex flex-col gap-1">
      <ChartContainer height={height}>
        <RcBarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} width={40} {...axisProps} />
          <Tooltip
            content={<ChartTooltipContent formatValue={(v) => `${v} défi${v > 1 ? 's' : ''}`} />}
            cursor={{ fill: 'rgba(59,76,202,0.08)' }}
          />
          <Bar dataKey="count" name="Défis" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </RcBarChart>
      </ChartContainer>
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
  if (cohorts.length === 0) {
    return <EmptyState label="Pas encore de cohortes." hint="Il faut des inscriptions pour en calculer." />;
  }
  const weeks = cohorts[0]?.retentionPct.length ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted">
        Chaque ligne suit un <span className="text-foreground">groupe d'inscrits</span> de la même
        semaine. <span className="text-foreground">S0</span> est leur semaine d'inscription,{' '}
        <span className="text-foreground">S+1</span> la suivante, etc. La case indique la part
        d'entre eux qui a joué cette semaine-là : plus c'est foncé, plus ils reviennent.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">Rétention par cohorte hebdomadaire d'inscription</caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left font-semibold text-muted">
                Inscrits la semaine du
              </th>
              <th scope="col" className="p-1 text-right font-semibold text-muted">
                Nb
              </th>
              {Array.from({ length: weeks }, (_, k) => (
                <th key={k} scope="col" className="p-1 text-center font-semibold text-muted">
                  {k === 0 ? 'S0' : `S+${k}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.week}>
                <th scope="row" className="whitespace-nowrap p-1 text-left font-semibold text-foreground">
                  {shortDate(c.week)}
                </th>
                <td className="p-1 text-right font-bold tabular-nums text-foreground">{c.size}</td>
                {c.retentionPct.map((v, k) => (
                  <td
                    key={k}
                    title={
                      v === null
                        ? 'Semaine pas encore écoulée'
                        : `${v}% des ${c.size} inscrit(s) ont joué`
                    }
                    className="rounded p-1 text-center font-bold tabular-nums"
                    style={
                      v === null
                        ? { color: CHART_MUTED }
                        : {
                            background: `rgba(59,76,202,${0.08 + (v / 100) * 0.6})`,
                            color: v > 60 ? '#fff' : CHART_INK,
                          }
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

      <p className={cn('text-[11px] font-semibold text-muted/70')}>
        « · » : semaine pas encore écoulée, la rétention n'est pas encore mesurable.
      </p>
    </div>
  );
}
