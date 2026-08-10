import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Database, MapPin, RefreshCw, TrendingDown } from 'lucide-react';
import type { AdminLevelDifficulty, AdminPokemonDifficulty } from '@pokegames/shared-types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  CellMeter,
  SortableHead,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { gameLabel, scopeLabel } from '@/features/daily/daily-catalog';
import {
  CohortTable,
  EmptyState,
  Histogram,
  LineChart,
  PieChart,
  SparkLine,
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
  getEtlStatus,
  startEtl,
} from './admin-api';
import { getApiErrorMessage } from '@/lib/errors';

/**
 * Titre de section de l'admin. Volontairement en Nunito et non en Press Start 2P : la police pixel
 * n'a pas de capitales accentuees (« DIFFICULTE » s'affichait « DIFFICULTé »), et un tableau de
 * bord se lit mieux dans une sans-serif.
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">{children}</h2>
  );
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
          <SparkLine
            series={[
              {
                label: 'Inscriptions',
                color: chartColor(3),
                points: data.timeline.map((p) => ({ x: p.date, y: p.signups })),
              },
            ]}
            height={210}
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

/** Colonnes triables du tableau de difficulte. */
type LevelSort = 'played' | 'success' | 'duration' | 'attempts';

/** Vert au-dessus de 70 %, orange au-dessus de 40 %, rouge en dessous : lecture immediate. */
function rateColor(pct: number): string {
  if (pct >= 70) return '#5fb24a';
  if (pct >= 40) return '#e8730c';
  return '#ee1515';
}

export function GamesTab({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-games-report', days],
    queryFn: () => getAdminGamesReport(days),
  });
  const [sort, setSort] = useState<LevelSort>('played');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const levels = useMemo(() => {
    const rows = [...(data?.levels ?? [])];
    const value = (l: AdminLevelDifficulty): number =>
      sort === 'played'
        ? l.played
        : sort === 'success'
          ? l.successRatePct
          : sort === 'duration'
            ? l.medianDurationSeconds
            : (l.avgAttempts ?? 0);
    rows.sort((a, b) => (dir === 'asc' ? value(a) - value(b) : value(b) - value(a)));
    return rows;
  }, [data?.levels, sort, dir]);

  if (isLoading || !data) return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;

  const toggle = (key: LevelSort) => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('desc');
    }
  };
  const head = (key: LevelSort, label: string, className?: string) => (
    <SortableHead
      label={label}
      active={sort === key}
      direction={dir}
      onClick={() => toggle(key)}
      {...(className ? { className } : {})}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Difficulté par niveau" hint="un défi quotidien terminé par ligne">
        {levels.length === 0 ? (
          <EmptyState label="Aucun défi terminé sur cette période." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jeu</TableHead>
                <TableHead>Niveau</TableHead>
                {head('played', 'Défis', 'text-right')}
                {head('success', 'Réussite')}
                {head('attempts', 'Essais', 'text-right')}
                {head('duration', 'Durée méd.', 'text-right')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((l) => (
                <TableRow key={`${l.gameType}-${l.scope}`}>
                  <TableCell className="font-bold">
                    <GameTag gameType={l.gameType} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-semibold text-muted">
                    {scopeLabel(l.scope) || '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{l.played}</TableCell>
                  <TableCell className="text-xs font-bold">
                    <CellMeter value={l.successRatePct} color={rateColor(l.successRatePct)} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted">
                    {l.avgAttempts ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-muted">
                    {l.medianDurationSeconds > 0 ? formatDuration(l.medianDurationSeconds) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pokémon les plus ratés" hint="au moins 3 parties">
          <PokemonTable rows={data.hardestPokemon} tone="#ee1515" />
        </Panel>

        <Panel title="Pokémon les plus trouvés" hint="au moins 3 parties">
          <PokemonTable rows={data.easiestPokemon} tone="#5fb24a" />
        </Panel>
      </div>

      {data.attempts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.attempts.map((a, i) => (
            <Panel key={a.gameType} title={`Essais · ${gameLabel(a.gameType)}`} hint="nombre de défis">
              <Histogram
                buckets={a.buckets.map((b) => ({ label: b.attempts, count: b.count }))}
                xLabel="essais pour terminer"
                color={chartColor(i)}
              />
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Indices" hint="usage moyen et effet sur la réussite">
        {data.hints.length === 0 ? (
          <EmptyState
            label="Aucun indice utilisé sur cette période."
            hint="Seuls la Silhouette et Poké-Motus proposent des indices."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jeu</TableHead>
                <TableHead className="text-right">Indices / partie</TableHead>
                <TableHead className="text-right">Réussite avec</TableHead>
                <TableHead className="text-right">Réussite sans</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.hints.map((h) => {
                const gap =
                  h.successWithHintsPct != null && h.successWithoutHintsPct != null
                    ? h.successWithHintsPct - h.successWithoutHintsPct
                    : null;
                return (
                  <TableRow key={h.gameType}>
                    <TableCell>
                      <GameTag gameType={h.gameType} />
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{h.avgHints}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {h.successWithHintsPct != null ? `${h.successWithHintsPct}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {h.successWithoutHintsPct != null ? `${h.successWithoutHintsPct}%` : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-bold tabular-nums',
                        gap == null ? 'text-muted' : gap >= 0 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap} pts`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableCaption>
              Un écart positif signifie que les indices aident vraiment à terminer le défi.
            </TableCaption>
          </Table>
        )}
      </Panel>

      <Panel title="Défis terminés" hint="volume par jeu et niveau">
        {data.completion.length === 0 ? (
          <EmptyState label="Aucun défi terminé sur cette période." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jeu</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead className="text-right">Terminés</TableHead>
                <TableHead className="text-right">Gagnés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.completion.map((c) => (
                <TableRow key={`${c.gameType}-${c.scope}`}>
                  <TableCell>
                    <GameTag gameType={c.gameType} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-semibold text-muted">
                    {scopeLabel(c.scope) || '—'}
                  </TableCell>
                  <TableCell>
                    <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-primary/15 sm:w-28">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${(c.completed / Math.max(1, ...data.completion.map((x) => x.completed))) * 100}%`,
                        }}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{c.completed}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted">
                    {c.won} ({c.wonPct}%)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/** Classement de Pokemon : meme tableau pour les plus rates et les plus trouves. */
function PokemonTable({ rows, tone }: { rows: AdminPokemonDifficulty[]; tone: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        label="Pas assez de parties."
        hint="Il faut au moins 3 parties sur un même Pokémon pour le classer."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8 text-right">#</TableHead>
          <TableHead>Pokémon</TableHead>
          <TableHead>Réussite</TableHead>
          <TableHead className="text-right">Parties</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p, i) => (
          <TableRow key={p.pokemonId}>
            <TableCell className="text-right font-bold tabular-nums text-muted">{i + 1}</TableCell>
            <TableCell className="font-bold text-foreground">{p.nameFr}</TableCell>
            <TableCell className="text-xs font-bold">
              <CellMeter value={p.successRatePct} color={tone} />
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums text-muted">
              {p.played}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-right">Sans jouer depuis</TableHead>
                <TableHead className="text-right">Jours actifs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.atRisk.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-bold text-foreground">{u.username}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-danger">
                    {u.daysSinceLastPlay ?? '—'} j
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted">
                    {u.gamesPlayed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        {data.zones.length === 0 ? (
          <EmptyState
            label="Aucune silhouette apparue pour l'instant."
            hint="Les apparitions se génèrent au fil des visites des joueurs."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Écran</TableHead>
                <TableHead>Taux de collecte</TableHead>
                <TableHead className="text-right">Ramassées</TableHead>
                <TableHead className="text-right">Apparues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.zones.map((z) => (
                <TableRow key={z.zone}>
                  <TableCell className="font-bold text-foreground">
                    {ZONE_LABEL[z.zone] ?? z.zone}
                  </TableCell>
                  <TableCell className="text-xs font-bold">
                    <CellMeter
                      value={z.ratePct}
                      color={z.ratePct < 25 ? '#ee1515' : z.ratePct < 60 ? '#e8730c' : '#5fb24a'}
                    />
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{z.collected}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted">
                    {z.spawned}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
        <EtlRunner />
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

/**
 * Lancement de l'import Tyradex depuis l'admin. L'import tourne en tache de fond cote serveur :
 * l'interface interroge l'etat toutes les 3 secondes pendant qu'il tourne, et se tait le reste du
 * temps (pas de sondage inutile).
 */
function EtlRunner() {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['admin-etl'],
    queryFn: getEtlStatus,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  });

  const run = useMutation({
    mutationFn: startEtl,
    onSuccess: (s) => {
      setConfirm(false);
      setError(null);
      queryClient.setQueryData(['admin-etl'], s);
    },
    onError: (err) => setError(getApiErrorMessage(err, "Échec du lancement de l'import")),
  });

  // L'import est termine : on rafraichit les compteurs du catalogue affiches au-dessus.
  useEffect(() => {
    if (status && !status.running && status.finishedAt) {
      void queryClient.invalidateQueries({ queryKey: ['admin-system'] });
    }
  }, [status, queryClient]);

  const running = status?.running ?? false;

  return (
    <div className="flex flex-col gap-2 border-t-2 border-border-strong/40 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-muted">
          <Database className="mt-0.5 h-3 w-3 shrink-0" />
          Réimporte le catalogue complet depuis Tyradex (noms, types, statistiques, sprites).
        </p>
        <Button size="sm" onClick={() => setConfirm(true)} disabled={running || run.isPending}>
          {running ? (
            <>
              <Spinner className="mr-1.5 h-4 w-4" />
              Import en cours
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Lancer l'import
            </>
          )}
        </Button>
      </div>

      {confirm && (
        <div className="flex flex-wrap items-center gap-2 rounded-control border-2 border-accent-shadow/50 bg-accent/10 px-3 py-2">
          <span className="text-xs font-semibold text-foreground">
            L'import dure environ une minute et sollicite la base. Lancer maintenant ?
          </span>
          <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Annuler
          </Button>
        </div>
      )}

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      {status?.startedAt && (
        <p className="text-[11px] font-semibold text-muted">
          {running
            ? `Démarré à ${formatTime(status.startedAt)} par ${status.triggeredBy ?? 'inconnu'}.`
            : status.error
              ? `Dernier import en échec (${formatTime(status.finishedAt)}) : ${status.error}`
              : `Dernier import réussi à ${formatTime(status.finishedAt)} : ${status.importedCount ?? 0} Pokémon.`}
        </p>
      )}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
