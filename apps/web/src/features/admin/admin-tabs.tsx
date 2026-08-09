import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Database, MapPin, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { gameLabel, scopeLabel } from '@/features/daily/daily-catalog';
import {
  BarChart,
  CohortTable,
  Histogram,
  LineChart,
  PieChart,
  chartColor,
} from './charts';
import { GameIcon, GameTag } from './game-icon';
import {
  formatDuration,
  getAdminGamesReport,
  getAdminOverview,
  getAdminPokedexReport,
  getAdminRetention,
  getAdminSystemInfo,
} from './admin-api';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[10px] uppercase tracking-widest text-muted">{children}</h2>;
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>{title}</SectionTitle>
        {hint && <span className="text-[11px] font-semibold text-muted">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

function levelName(gameType: string, scope: string): string {
  const s = scopeLabel(scope);
  return s ? `${gameLabel(gameType)} · ${s}` : gameLabel(gameType);
}

/** Noms lisibles des zones d'apparition (le serveur renvoie des identifiants techniques). */
const ZONE_LABEL: Record<string, string> = {
  home: 'Accueil',
  quests: 'Quêtes',
  leaderboard: 'Classements',
  history: 'Historique',
  silhouette: 'Quel est ce Pokémon',
  motus: 'Poké-Motus',
  'plus-minus': 'Plus ou Moins',
  intruder: "L'Intrus",
  'just-stat': 'La Juste Stat',
  'true-shiny': 'Le Bon Shiny',
  shiny: 'Trouve le shiny',
  'guess-who': 'Qui est-ce',
};

/* ------------------------------------------------------- Onglet Vue d'ensemble */

export function OverviewCharts({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview', days],
    queryFn: () => getAdminOverview(days),
  });

  if (isLoading || !data) return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Activité" hint="parties et joueurs distincts par jour">
        <LineChart
          series={[
            { label: 'Parties', color: chartColor(0), points: data.timeline.map((p) => ({ x: p.date, y: p.games })) },
            { label: 'Joueurs', color: chartColor(1), points: data.timeline.map((p) => ({ x: p.date, y: p.players })) },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Répartition des parties" hint="par jeu">
          <PieChart
            slices={data.shares.map((s, i) => ({
              label: gameLabel(s.gameType),
              value: s.games,
              color: chartColor(i),
              icon: <GameIcon gameType={s.gameType} className="h-4 w-4" />,
            }))}
          />
        </Panel>

        <Panel title="Inscriptions" hint="nouveaux comptes par jour">
          <LineChart
            series={[
              {
                label: 'Inscriptions',
                color: chartColor(3),
                points: data.timeline.map((p) => ({ x: p.date, y: p.signups })),
              },
            ]}
            height={160}
          />
        </Panel>
      </div>

      <Panel title="Pokédex" hint="progression moyenne des collectionneurs">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="text-[2rem] font-extrabold leading-none text-foreground">
            {data.pokedexAvgCollected}
            <span className="ml-1 text-sm font-semibold text-muted">
              / {data.pokedexTotalSpecies} espèces
            </span>
          </p>
          <p className="text-sm font-semibold text-muted">soit {data.pokedexAvgPct} % du Pokédex</p>
        </div>
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------------- Onglet Jeux */

export function GamesTab({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-games-report', days],
    queryFn: () => getAdminGamesReport(days),
  });

  if (isLoading || !data) return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Difficulté par niveau" hint="taux de réussite ; défis terminés">
        <BarChart
          max={100}
          rows={data.levels.map((l) => ({
            key: `${l.gameType}-${l.scope}`,
            label: <GameTag gameType={l.gameType} suffix={scopeLabel(l.scope)} />,
            value: l.successRatePct,
            hint: (
              <>
                {l.successRatePct}% · {l.played} défi{l.played > 1 ? 's' : ''}
                {l.avgAttempts != null && <> · {l.avgAttempts} essais</>}
                {l.medianDurationSeconds > 0 && <> · {formatDuration(l.medianDurationSeconds)}</>}
              </>
            ),
          }))}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pokémon les plus ratés" hint="au moins 3 parties">
          <BarChart
            max={100}
            rows={data.hardestPokemon.map((p) => ({
              label: p.nameFr,
              value: p.successRatePct,
              color: '#ee1515',
              hint: `${p.successRatePct}% · ${p.played} parties`,
            }))}
          />
        </Panel>

        <Panel title="Pokémon les plus trouvés" hint="au moins 3 parties">
          <BarChart
            max={100}
            rows={data.easiestPokemon.map((p) => ({
              label: p.nameFr,
              value: p.successRatePct,
              color: '#5fb24a',
              hint: `${p.successRatePct}% · ${p.played} parties`,
            }))}
          />
        </Panel>
      </div>

      {data.attempts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.attempts.map((a) => (
            <Panel key={a.gameType} title={`Essais · ${gameLabel(a.gameType)}`} hint="nombre de défis">
              <Histogram
                buckets={a.buckets.map((b) => ({ label: b.attempts, count: b.count }))}
                xLabel="essais pour terminer"
              />
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Indices" hint="usage moyen et effet sur la réussite">
        {data.hints.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-muted">
            Aucun indice utilisé sur la période.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.hints.map((h) => (
              <div
                key={h.gameType}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border-2 border-border-strong bg-surface-2/50 px-3 py-2"
              >
                <GameTag gameType={h.gameType} className="text-sm" />
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {h.avgHints} indice(s) en moyenne · réussite{' '}
                  <span className="text-foreground">{h.successWithHintsPct ?? '—'}%</span> avec /{' '}
                  <span className="text-foreground">{h.successWithoutHintsPct ?? '—'}%</span> sans
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Défis terminés" hint="volume par jeu et niveau">
        <BarChart
          rows={data.completion.map((c) => ({
            key: `${c.gameType}-${c.scope}`,
            label: <GameTag gameType={c.gameType} suffix={scopeLabel(c.scope)} />,
            value: c.completed,
            hint: `${c.completed} terminé${c.completed > 1 ? 's' : ''} · ${c.wonPct}% gagnés`,
          }))}
        />
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------- Onglet Rétention */

export function RetentionTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-retention'],
    queryFn: getAdminRetention,
  });

  if (isLoading || !data) return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Cohortes" hint="part des inscrits encore actifs, semaine par semaine">
        <CohortTable cohorts={data.cohorts} />
      </Panel>

      <Panel title="Assiduité" hint="joueurs par nombre de jours joués">
        <Histogram
          buckets={data.daysPlayed.map((d) => ({ label: d.days, count: d.users }))}
          xLabel="jours joués"
        />
      </Panel>

      <Panel title="Joueurs qui décrochent" hint="sans partie depuis 7 jours ou plus">
        {data.atRisk.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-4 text-center text-sm font-semibold text-muted">
            <TrendingDown className="h-4 w-4" /> Personne ne décroche pour l'instant.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.atRisk.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border-2 border-accent-shadow/40 bg-accent/10 px-3 py-2"
              >
                <span className="text-sm font-bold text-foreground">{u.username}</span>
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {u.daysSinceLastPlay} jours sans jouer · {u.gamesPlayed} jours actifs
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ Onglet Pokédex */

export function PokedexTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pokedex-report'],
    queryFn: getAdminPokedexReport,
  });

  if (isLoading || !data) return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[2rem] font-extrabold leading-none text-foreground">{data.collectors}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Collectionneurs</p>
        </Card>
        <Card className="p-4">
          <p className="text-[2rem] font-extrabold leading-none text-foreground">{data.avgCollected}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Captures en moyenne</p>
        </Card>
        <Card className="p-4">
          <p className="text-[2rem] font-extrabold leading-none text-foreground">{data.avgPct}%</p>
          <p className="mt-1 text-xs font-semibold text-muted">du Pokédex complété</p>
        </Card>
      </div>

      <Panel title="Taux de collecte par écran">
        <p className="text-xs font-semibold text-muted">
          Part des silhouettes apparues sur un écran qui ont été ramassées. Les écrans les moins
          performants sont en tête : un taux bas veut dire que la page est peu visitée, ou que la
          silhouette y est difficile à repérer.
        </p>
        <BarChart
          max={100}
          rows={data.zones.map((z) => ({
            label: ZONE_LABEL[z.zone] ?? z.zone,
            value: z.ratePct,
            color: z.ratePct < 25 ? '#ee1515' : z.ratePct < 60 ? '#e8730c' : '#5fb24a',
            hint: `${z.collected} ramassées sur ${z.spawned} · ${z.ratePct}%`,
          }))}
        />
        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-muted/70">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          Rouge sous 25 %, orange sous 60 %, vert au-delà.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ Onglet Système */

export function SystemTab({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({ queryKey: ['admin-system'], queryFn: getAdminSystemInfo });

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Catalogue Pokémon" hint="données issues de l'ETL Tyradex">
        {!data ? (
          <Spinner className="mx-auto my-4 h-5 w-5 text-primary" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Espèces', value: data.pokemonCount },
              { label: 'Avec sprite shiny', value: data.withShinySprite },
              { label: 'Avec méga-évolution', value: data.withMega },
              {
                label: 'Dernière mise à jour',
                value: data.lastPokemonUpdate
                  ? new Date(data.lastPokemonUpdate).toLocaleDateString('fr-FR')
                  : '—',
              },
            ].map((s) => (
              <div key={s.label} className="rounded-control border-2 border-border-strong bg-surface-2/50 p-3">
                <p className="text-lg font-extrabold leading-none text-foreground">{s.value}</p>
                <p className="mt-1 text-[11px] font-semibold text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-muted">
          <Database className="mt-0.5 h-3 w-3 shrink-0" />
          Le catalogue se rafraîchit avec <code className="font-mono">npm run etl</code> côté serveur.
        </p>
      </Panel>

      <Panel title="Tirages du jour" hint="ce que les jeux ont pioché aujourd'hui">
        {!data ? null : data.todayPicks.length === 0 ? (
          <p className="py-3 text-center text-sm font-semibold text-muted">
            Aucun tirage enregistré aujourd'hui.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.todayPicks.map((p) => (
              <span
                key={`${p.game}-${p.scope}`}
                className="rounded-control border-2 border-border-strong bg-surface-2/50 px-2 py-1 text-xs font-semibold text-foreground"
              >
                {levelName(p.game, p.scope)}{' '}
                <span className="tabular-nums text-muted">· {p.count}</span>
              </span>
            ))}
          </div>
        )}
      </Panel>

      {children}
    </div>
  );
}

/** Bandeau d'avertissement reutilisable (config, actions sensibles). */
export function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-control border-2 border-accent-shadow/40 bg-accent/10 px-3 py-2',
        'text-xs font-semibold text-foreground',
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}
