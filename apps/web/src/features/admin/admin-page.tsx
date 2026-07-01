import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';
import { gameLabel } from '@/features/daily/daily-catalog';
import {
  formatDuration,
  getAdminAuditLogs,
  getAdminStats,
  getAdminUser,
  getAdminUsers,
} from './admin-api';

const TAB_BASE = 'rounded-control border-2 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer';

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
  const [tab, setTab] = useState<'dashboard' | 'users'>('dashboard');

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
          <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-sm text-foreground">Administration</h1>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className={cn(
              TAB_BASE,
              tab === 'dashboard'
                ? 'border-primary-shadow bg-primary text-primary-foreground'
                : 'border-border-strong bg-surface-2/60 text-muted',
            )}
          >
            Tableau de bord
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={cn(
              TAB_BASE,
              tab === 'users'
                ? 'border-primary-shadow bg-primary text-primary-foreground'
                : 'border-border-strong bg-surface-2/60 text-muted',
            )}
          >
            Utilisateurs
          </button>
        </div>
      </div>

      {tab === 'dashboard' ? <DashboardTab /> : <UsersTab />}
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

function DashboardTab() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats });
  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => getAdminAuditLogs(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Utilisateurs" value={stats?.totalUsers ?? '—'} />
        <StatCard label="Parties" value={stats?.totalGames ?? '—'} />
        <StatCard label="Réussies" value={stats?.successfulGames ?? '—'} />
        <StatCard label="Taux de réussite" value={stats ? `${stats.successRatePct}%` : '—'} />
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-xs uppercase text-foreground">Historique des parties</h2>
        {isLoading ? (
          <Spinner className="mx-auto my-6 h-6 w-6 text-primary" />
        ) : (logs?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-muted">Aucune partie enregistrée.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {logs?.map((log) => (
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
      </Card>
    </div>
  );
}

function UsersTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers });
  const { data: detail } = useQuery({
    queryKey: ['admin-user', selected],
    queryFn: () => getAdminUser(selected as string),
    enabled: Boolean(selected),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-display text-xs uppercase text-foreground">Utilisateurs</h2>
        {isLoading ? (
          <Spinner className="mx-auto my-6 h-6 w-6 text-primary" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {users?.map((u) => (
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
              <p className="text-xs text-muted">Elo</p>
              <p className="font-bold text-foreground">{detail.eloScore}</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-muted">
            {detail.email} · inscrit le {formatDate(detail.createdAt)}
          </p>
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
    </div>
  );
}
