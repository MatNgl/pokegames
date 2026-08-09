import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CalendarDays,
  Flame,
  Gamepad2,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/auth-context';
import { gameLabel, scopeLabel } from '@/features/daily/daily-catalog';
import {
  deleteAdminUser,
  formatDuration,
  getAdminAnomalies,
  getAdminAuditLogs,
  getAdminStats,
  getAdminUser,
  getAdminUsers,
  resetAdminUserDaily,
  updateAdminUserRole,
} from './admin-api';
import { ConfigTab } from './config-tab';
import {
  GamesTab,
  OverviewCharts,
  PokedexTab,
  RetentionTab,
  SectionTitle,
  SystemTab,
} from './admin-tabs';
import { BarChart, LineChart, chartColor } from './charts';
import { GameIcon } from './game-icon';

const TAB_BASE =
  'flex-1 rounded-control border-2 px-3 py-2 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:flex-none';

const TABS = [
  { key: 'dashboard', label: "Vue d'ensemble" },
  { key: 'games', label: 'Jeux' },
  { key: 'users', label: 'Joueurs' },
  { key: 'pokedex', label: 'Pokédex' },
  { key: 'system', label: 'Système' },
] as const;

type AdminTab = (typeof TABS)[number]['key'];

const SORTS = [
  { key: 'recent', label: 'Récents' },
  { key: 'games', label: 'Parties' },
  { key: 'time', label: 'Temps joué' },
  { key: 'name', label: 'Nom' },
] as const;

// Fenetre d'analyse partagee par les onglets qui exposent des series temporelles.
const PERIODS = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 0, label: 'Tout' },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">{children}</main>
      </div>
    </AppBackground>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminPage() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [days, setDays] = useState<number>(30);

  if (initializing) {
    return (
      <Shell>
        <Spinner className="mt-16 h-7 w-7 text-primary" />
      </Shell>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <Shell>
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-sm text-foreground">Accès réservé</h1>
          <p className="text-sm font-semibold text-muted">
            Cette section est réservée aux administrateurs.
          </p>
          <Button className="w-full" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-sm text-foreground">Administration</h1>
        {/* Selecteur de periode : ne concerne que les onglets a series temporelles. */}
        {(tab === 'dashboard' || tab === 'games') && (
          <div className="flex gap-1" role="group" aria-label="Période d'analyse">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                aria-pressed={days === p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  'min-h-9 rounded-control border-2 px-2.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  days === p.days
                    ? 'border-primary-shadow bg-primary text-primary-foreground'
                    : 'border-border-strong bg-surface-2/60 text-muted',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Onglets scrollables horizontalement : 5 entrees ne tiennent pas a 375px. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5 sm:w-full">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                TAB_BASE,
                tab === t.key
                  ? 'border-primary-shadow bg-primary text-primary-foreground'
                  : 'border-border-strong bg-surface-2/60 text-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && (
        <>
          <DashboardTab />
          <OverviewCharts days={days} />
        </>
      )}
      {tab === 'games' && <GamesTab days={days} />}
      {tab === 'users' && (
        <>
          <UsersTab />
          <RetentionTab />
        </>
      )}
      {tab === 'pokedex' && <PokedexTab />}
      {tab === 'system' && (
        <SystemTab>
          <ConfigTab />
        </SystemTab>
      )}

      <Button className="w-full" onClick={() => navigate('/')}>
        Retour à l'accueil
      </Button>
    </Shell>
  );
}

/**
 * Tuile de statistique. La valeur est en Nunito (police du corps) et non en Press Start 2P : un
 * chiffre en police pixel est illisible en grand. Le pixel reste sur les intitules de section, ou
 * il joue son role de signature de marque sans gener la lecture.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-4">
      {/* Icone masquee sous sm : a 375px elle volait la place du libelle, qui se retrouvait tronque.
          Elle est decorative, c'est le libelle qui porte le sens. */}
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary sm:flex">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[2rem] font-extrabold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
        {hint && <p className="text-[11px] font-semibold text-muted/70">{hint}</p>}
      </div>
    </Card>
  );
}

/**
 * Auteur d'une partie dans le journal. Trois cas distincts : un compte (pseudo), un invite (pas de
 * compte), ou un compte supprime depuis (l'userId subsiste dans GameAuditLog, sans cle etrangere).
 */
function PlayerTag({ userId, username }: { userId: string | null; username: string | null }) {
  if (!userId) {
    return (
      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted">
        Invité
      </span>
    );
  }
  if (!username) {
    return (
      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted italic">
        Compte supprimé
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
      {username}
    </span>
  );
}

/** Intitule de section : c'est ici que la police pixel de la marque garde sa place. */

/**
 * Jauge d'un ratio (0 a 100). Teinte unique : le fond est une version claire de la meme couleur que
 * le remplissage. Le pourcentage est toujours ecrit a cote, car ces verts et oranges passent sous
 * 3:1 sur le fond creme : la couleur seule ne doit jamais porter l'information.
 */
function RateMeter({ pct }: { pct: number }) {
  const value = Math.max(0, Math.min(100, pct));
  return (
    <span
      role="img"
      aria-label={`${value} % de réussite`}
      className="block h-2 w-full overflow-hidden rounded-full bg-primary/15"
    >
      <span
        className="block h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </Button>
      <span className="text-xs font-semibold text-muted">
        Page {page} / {lastPage}
      </span>
      <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        Suivant
      </Button>
    </div>
  );
}

function DashboardTab() {
  const [page, setPage] = useState(1);
  const [gameFilter, setGameFilter] = useState('');
  const [outcome, setOutcome] = useState('');
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats });
  const { data: anomalies } = useQuery({ queryKey: ['admin-anomalies'], queryFn: getAdminAnomalies });
  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-logs', page, gameFilter, outcome],
    queryFn: () => getAdminAuditLogs(page, gameFilter || undefined, outcome || undefined),
  });

  const applyFilter = (next: { game?: string; outcome?: string }) => {
    if (next.game !== undefined) setGameFilter(next.game);
    if (next.outcome !== undefined) setOutcome(next.outcome);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Deux groupes nommes plutot que huit tuiles indifferenciees : on sait ce qu'on lit. */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Joueurs</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Users} label="Comptes au total" value={stats?.totalUsers ?? '—'} />
          <StatCard icon={Activity} label="Actifs aujourd'hui" value={stats?.activeUsersToday ?? '—'} />
          <StatCard icon={CalendarDays} label="Actifs sur 7 jours" value={stats?.activeUsers7d ?? '—'} />
          <StatCard icon={UserPlus} label="Inscrits sur 7 jours" value={stats?.newUsers7d ?? '—'} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Parties</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Gamepad2} label="Parties au total" value={stats?.totalGames ?? '—'} />
          <StatCard icon={Zap} label="Parties aujourd'hui" value={stats?.gamesToday ?? '—'} />
          <StatCard icon={Trophy} label="Parties réussies" value={stats?.successfulGames ?? '—'} />
          <Card className="flex flex-col justify-center gap-2 p-3 sm:p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[2rem] font-extrabold leading-none text-foreground">
                {stats ? `${stats.successRatePct}%` : '—'}
              </span>
            </div>
            {stats && <RateMeter pct={stats.successRatePct} />}
            <p className="text-xs font-semibold text-muted">Taux de réussite</p>
          </Card>
        </div>
      </section>

      {/* Anomalies : exploitation du journal d'audit (manches trop rapides, sans-faute anormal). */}
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-2 font-display text-xs uppercase text-foreground">
          <ShieldAlert className="h-4 w-4 text-danger" />
          Anomalies détectées
        </h2>
        {!anomalies ? (
          <Spinner className="mx-auto my-4 h-5 w-5 text-primary" />
        ) : anomalies.length === 0 ? (
          <p className="py-3 text-center text-sm font-semibold text-muted">
            Rien à signaler, aucun comportement suspect.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {anomalies.map((a, i) => (
              <div
                key={`${a.userId}-${a.kind}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border-2 border-danger/40 bg-danger/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {a.username ?? 'Invité'}
                    <span className="font-semibold text-muted"> · {gameLabel(a.gameType)}</span>
                  </p>
                  <p className="text-xs font-semibold text-muted">{a.detail}</p>
                </div>
                <Badge className="shrink-0 border-danger bg-danger text-white">
                  {a.kind === 'FAST_SOLVE' ? 'Trop rapide' : 'Sans-faute'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Volumes par jeu : reperer un jeu delaisse ou anormalement facile/difficile. */}
      {/* Une jauge par jeu au lieu d'une ligne de texte : le taux se compare d'un coup d'oeil.
          Chiffres en tabular-nums car ils forment des colonnes qui doivent s'aligner. */}
      {stats && stats.perGame.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <SectionTitle>Par jeu</SectionTitle>
            <span className="text-[11px] font-semibold text-muted">
              parties · réussite · durée médiane
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {stats.perGame.map((g) => (
              <div key={g.gameType} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">
                    {gameLabel(g.gameType)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
                    {g.games} · <span className="text-foreground">{g.successRatePct}%</span> ·{' '}
                    {formatDuration(g.medianDurationSeconds)}
                  </span>
                </div>
                <RateMeter pct={g.successRatePct} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-xs uppercase text-foreground">Historique des parties</h2>

        {/* Filtres : le back acceptait deja gameType, le front ne l'utilisait jamais. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={gameFilter}
            onChange={(e) => applyFilter({ game: e.target.value })}
            aria-label="Filtrer par jeu"
            className="h-11 flex-1 rounded-control border-2 border-border-strong bg-white px-2 text-sm font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            <option value="">Tous les jeux</option>
            {(stats?.perGame ?? []).map((g) => (
              <option key={g.gameType} value={g.gameType}>
                {gameLabel(g.gameType)}
              </option>
            ))}
          </select>
          <select
            value={outcome}
            onChange={(e) => applyFilter({ outcome: e.target.value })}
            aria-label="Filtrer par issue"
            className="h-11 flex-1 rounded-control border-2 border-border-strong bg-white px-2 text-sm font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            <option value="">Toutes les issues</option>
            <option value="success">Réussies</option>
            <option value="fail">Échouées</option>
          </select>
        </div>

        {isLoading ? (
          <Spinner className="mx-auto my-6 h-6 w-6 text-primary" />
        ) : (logs?.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-muted">Aucune partie enregistrée.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {logs?.items.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-2 rounded-control border-2 border-border-strong bg-surface-2/50 px-3 py-2"
              >
                <div className="min-w-0">
                  {/* Le joueur en premier : c'est la question qu'on se pose en lisant le journal. */}
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold text-foreground">
                    <PlayerTag userId={log.userId} username={log.username} />
                    <GameIcon gameType={log.gameType} className="h-5 w-5" />
                    <span className="truncate font-semibold text-muted">
                      {gameLabel(log.gameType)} · {log.targetNameFr}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-muted">
                    {formatDate(log.createdAt)} · {formatDuration(log.durationSeconds)}
                  </p>
                </div>
                <Badge
                  className={cn(
                    'shrink-0',
                    log.isSuccess
                      ? 'border-go-shadow bg-go text-go-foreground'
                      : 'border-border-strong bg-surface text-muted',
                  )}
                >
                  {log.isSuccess ? 'Réussi' : 'Échoué'}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {logs && (
          <Pager page={logs.page} total={logs.total} pageSize={logs.pageSize} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('recent');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', page, query, sort],
    queryFn: () => getAdminUsers(page, query || undefined, sort),
  });
  const { data: detail } = useQuery({
    queryKey: ['admin-user', selected],
    queryFn: () => getAdminUser(selected as string),
    enabled: Boolean(selected),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-user'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setActionError(null);
    setActionOk(null);
    try {
      await fn();
      setActionOk(label);
      refresh();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Action impossible'));
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
    setPage(1);
    setSelected(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-display text-xs uppercase text-foreground">Utilisateurs</h2>

        {/* Tri : parties et temps joue sont agreges depuis le journal, pas triables en base. */}
        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => {
                setSort(s.key);
                setPage(1);
              }}
              className={cn(
                'min-h-9 rounded-control border-2 px-2.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                sort === s.key
                  ? 'border-primary-shadow bg-primary text-primary-foreground'
                  : 'border-border-strong bg-surface-2/60 text-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pseudo ou un email"
            aria-label="Rechercher un utilisateur"
          />
          <Button type="submit" size="sm">
            <Search className="h-4 w-4" />
          </Button>
          {query && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setQuery('');
                setPage(1);
              }}
            >
              Effacer
            </Button>
          )}
        </form>

        {actionError && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            {actionError}
          </p>
        )}
        {actionOk && (
          <p role="status" className="rounded-control bg-go/10 px-3 py-2 text-sm font-semibold text-go-shadow">
            {actionOk}
          </p>
        )}

        {isLoading ? (
          <Spinner className="mx-auto my-6 h-6 w-6 text-primary" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {users?.items.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u.id === selected ? null : u.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-control border-2 px-3 py-2 text-left',
                  u.id === selected ? 'border-primary bg-primary/10' : 'border-border-strong bg-surface-2/50',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">
                    {u.username}
                    {u.role === 'ADMIN' && (
                      <span className="ml-1 text-xs font-semibold text-primary">admin</span>
                    )}
                  </p>
                  <p className="truncate text-xs font-semibold text-muted">{u.email}</p>
                </div>
                <div className="shrink-0 text-right text-xs font-semibold text-muted">
                  <p>{u.gamesPlayed} parties</p>
                  <p>{formatDuration(u.totalTimeSeconds)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {users && (
          <Pager page={users.page} total={users.total} pageSize={users.pageSize} onPage={setPage} />
        )}
      </Card>

      {selected && detail && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-display text-xs uppercase text-foreground">{detail.username}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Parties</p>
              <p className="font-bold text-foreground">{detail.gamesPlayed}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Temps joué</p>
              <p className="font-bold text-foreground">{formatDuration(detail.totalTimeSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Défis (jour)</p>
              <p className="font-bold text-foreground">{detail.dailyResultsCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Pokédex</p>
              <p className="font-bold text-foreground">{detail.pokedexCount}</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-muted">
            {detail.email} · inscrit le {formatDate(detail.createdAt)} · rôle {detail.role}
          </p>

          {/* Assiduite : la serie en cours est l'indicateur qui donne envie de revenir chaque jour. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-control border-2 border-go-shadow/40 bg-go/10 p-2.5">
              <p className="flex items-baseline gap-1 text-xl font-extrabold leading-none text-foreground">
                <Flame className="h-4 w-4 text-danger" />
                {detail.currentStreakDays}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted">Série en cours (jours)</p>
            </div>
            <div className="rounded-control border-2 border-border-strong bg-surface-2/50 p-2.5">
              <p className="text-xl font-extrabold leading-none text-foreground">
                {detail.longestStreakDays}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted">Record de série</p>
            </div>
            <div className="rounded-control border-2 border-border-strong bg-surface-2/50 p-2.5">
              <p className="text-xl font-extrabold leading-none text-foreground">{detail.activeDays}</p>
              <p className="mt-1 text-[11px] font-semibold text-muted">Jours actifs</p>
            </div>
            <div className="rounded-control border-2 border-border-strong bg-surface-2/50 p-2.5">
              <p className="text-xl font-extrabold leading-none text-foreground">
                {detail.lastPlayedAt ? formatDate(detail.lastPlayedAt).split(' ')[0] : '—'}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted">Dernière partie</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-muted">
            Devance {detail.percentileGames} % des joueurs en parties, {detail.percentilePokedex} % au
            Pokédex.
          </p>

          {/* Progression du Pokedex : total, detail par generation, puis courbe des captures. */}
          <div className="flex flex-col gap-2 border-t-2 border-border-strong/40 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle>Pokédex</SectionTitle>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {detail.pokedexCount} / {detail.pokedexTotalSpecies}
              </span>
            </div>
            <span className="block h-2 w-full overflow-hidden rounded-full bg-primary/15">
              <span
                className="block h-full rounded-full bg-primary"
                style={{
                  width: `${detail.pokedexTotalSpecies ? (detail.pokedexCount / detail.pokedexTotalSpecies) * 100 : 0}%`,
                }}
              />
            </span>
            {detail.pokedexByGeneration.length > 0 && (
              <BarChart
                max={100}
                rows={detail.pokedexByGeneration.map((g) => ({
                  label: `Génération ${g.generation}`,
                  value: g.total ? Math.round((g.collected / g.total) * 100) : 0,
                  hint: `${g.collected}/${g.total}`,
                }))}
              />
            )}
            {detail.pokedexTimeline.length > 1 && (
              <LineChart
                height={120}
                series={[
                  {
                    label: 'Captures cumulées',
                    color: chartColor(0),
                    points: detail.pokedexTimeline.map((p) => ({ x: p.date, y: p.total })),
                  },
                ]}
              />
            )}
          </div>

          {/* Actions de moderation : evitent de passer par psql pour la moindre operation. */}
          <div className="flex flex-wrap gap-2 border-t-2 border-border-strong/40 pt-3">
            {detail.role === 'ADMIN' ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={detail.id === me?.id}
                onClick={() =>
                  void run('Rôle mis à jour : USER', () => updateAdminUserRole(detail.id, 'USER'))
                }
              >
                <ShieldOff className="h-4 w-4" />
                Retirer admin
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  void run('Rôle mis à jour : ADMIN', () => updateAdminUserRole(detail.id, 'ADMIN'))
                }
              >
                <Shield className="h-4 w-4" />
                Promouvoir admin
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void run('Défis du jour réinitialisés', () => resetAdminUserDaily(detail.id))
              }
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser ses défis du jour
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={detail.id === me?.id}
              onClick={() => setConfirmDelete(detail.id)}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          </div>

          {detail.recentDailyResults.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="font-display text-[10px] uppercase tracking-widest text-muted">
                Défis quotidiens récents
              </p>
              {detail.recentDailyResults.map((d) => (
                <div
                  key={`${d.gameType}-${d.scope}-${d.dayDate}`}
                  className="flex items-center justify-between gap-2 rounded-control px-1.5 py-1 text-xs odd:bg-surface-2/40"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <GameIcon gameType={d.gameType} className="h-5 w-5" />
                    <span className="min-w-0 truncate font-semibold text-foreground">
                      {gameLabel(d.gameType)}
                      {d.scope && <span className="text-muted"> · {scopeLabel(d.scope)}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-muted">{d.dayDate}</span>
                    <span className={cn('font-bold', d.won ? 'text-success' : 'text-muted')}>
                      {d.correctCount != null && d.totalRounds != null
                        ? `${d.correctCount}/${d.totalRounds}`
                        : d.attempts != null
                          ? `${d.attempts} essais`
                          : (d.score ?? '—')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {detail.recentGames.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="font-display text-[10px] uppercase tracking-widest text-muted">
                Parties récentes
              </p>
              {detail.recentGames.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-control px-1.5 py-1 text-xs odd:bg-surface-2/40"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <GameIcon gameType={g.gameType} className="h-5 w-5" />
                    <span className="min-w-0 truncate font-semibold text-foreground">
                      {gameLabel(g.gameType)}
                      <span className="text-muted"> · {g.targetNameFr}</span>
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-bold', g.isSuccess ? 'text-success' : 'text-danger')}>
                    {g.isSuccess ? 'Réussi' : 'Échoué'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-title"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-card border-4 border-border-strong bg-surface p-6 text-center shadow-xl"
          >
            <h2 id="admin-delete-title" className="font-display text-sm leading-relaxed text-foreground">
              Supprimer ce compte ?
            </h2>
            <p className="text-sm font-semibold text-muted">
              Le compte, son historique, ses résultats et son Pokédex seront définitivement effacés.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  const id = confirmDelete;
                  setConfirmDelete(null);
                  setSelected(null);
                  void run('Compte supprimé', () => deleteAdminUser(id));
                }}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
