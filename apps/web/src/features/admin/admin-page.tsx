import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Search, Shield, ShieldAlert, ShieldOff, Trash2 } from 'lucide-react';
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
import { gameLabel } from '@/features/daily/daily-catalog';
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

const TAB_BASE =
  'flex-1 rounded-control border-2 px-3 py-2 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:flex-none';

const TABS = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'users', label: 'Utilisateurs' },
  { key: 'config', label: 'Configuration' },
] as const;

type AdminTab = (typeof TABS)[number]['key'];

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
      {/* flex-wrap + onglets pleine largeur sous sm : sans ca la ligne reclame ~489px pour 343px
          disponibles sur mobile, et l'onglet Configuration sort du viewport (overflow-x masque). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-sm text-foreground">Administration</h1>
        <div className="flex w-full gap-1.5 sm:w-auto">
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

      {tab === 'dashboard' ? <DashboardTab /> : tab === 'users' ? <UsersTab /> : <ConfigTab />}
      <Button className="w-full" onClick={() => navigate('/')}>
        Retour à l'accueil
      </Button>
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="flex flex-col items-center gap-1 p-4 text-center">
      <span className="font-display text-2xl text-primary">{value}</span>
      <span className="text-xs font-semibold text-muted">{label}</span>
    </Card>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Utilisateurs" value={stats?.totalUsers ?? '—'} />
        <StatCard label="Actifs aujourd'hui" value={stats?.activeUsersToday ?? '—'} />
        <StatCard label="Actifs 7 jours" value={stats?.activeUsers7d ?? '—'} />
        <StatCard label="Inscrits 7 jours" value={stats?.newUsers7d ?? '—'} />
        <StatCard label="Parties" value={stats?.totalGames ?? '—'} />
        <StatCard label="Parties aujourd'hui" value={stats?.gamesToday ?? '—'} />
        <StatCard label="Réussies" value={stats?.successfulGames ?? '—'} />
        <StatCard label="Taux de réussite" value={stats ? `${stats.successRatePct}%` : '—'} />
      </div>

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
      {stats && stats.perGame.length > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="font-display text-xs uppercase text-foreground">Par jeu</h2>
          <div className="flex flex-col gap-1.5">
            {stats.perGame.map((g) => (
              <div
                key={g.gameType}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border-2 border-border-strong bg-surface-2/50 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-bold text-foreground">
                  {gameLabel(g.gameType)}
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted">
                  {g.games} parties · {g.successRatePct}% réussite · médiane{' '}
                  {formatDuration(g.medianDurationSeconds)}
                </span>
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
                  <p className="truncate text-sm font-bold text-foreground">
                    {gameLabel(log.gameType)}
                    <span className="font-semibold text-muted"> · {log.targetNameFr}</span>
                  </p>
                  <p className="text-xs font-semibold text-muted">
                    {formatDate(log.createdAt)} · {formatDuration(log.durationSeconds)}
                    {log.userId ? '' : ' · invité'}
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', page, query],
    queryFn: () => getAdminUsers(page, query || undefined),
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
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate font-semibold text-foreground">
                    {d.dayDate} · {gameLabel(d.gameType)}
                    {d.scope && <span className="text-muted"> · {d.scope}</span>}
                  </span>
                  <span className={cn('shrink-0', d.won ? 'text-success' : 'text-muted')}>
                    {d.correctCount != null && d.totalRounds != null
                      ? `${d.correctCount}/${d.totalRounds}`
                      : d.attempts != null
                        ? `${d.attempts} essais`
                        : (d.score ?? '—')}
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
                <div key={g.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-foreground">
                    {gameLabel(g.gameType)} · {g.targetNameFr}
                  </span>
                  <span className={cn('shrink-0', g.isSuccess ? 'text-success' : 'text-danger')}>
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
