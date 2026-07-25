import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PokedexCatalogEntry } from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { API_ORIGIN } from '@/lib/env';
import { useAuth } from '@/features/auth/auth-context';
import {
  getPokedexCatalog,
  getPokedexCollection,
  getPokedexDetail,
  markPokedexSeen,
} from './pokedex-api';

const PAGE_SIZE = 60;
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function padId(n: number): string {
  return `N°${String(n).padStart(4, '0')}`;
}

function DetailPanel({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pokedex-detail', id],
    queryFn: () => getPokedexDetail(id),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full min-h-52 items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  const stats: { label: string; value: number }[] = [
    { label: 'PV', value: data.stats.hp },
    { label: 'Attaque', value: data.stats.atk },
    { label: 'Défense', value: data.stats.def },
    { label: 'Atq. Spé', value: data.stats.speAtk },
    { label: 'Déf. Spé', value: data.stats.speDef },
    { label: 'Vitesse', value: data.stats.speed },
  ];

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="font-display text-[10px] text-muted">{padId(data.pokedexId)}</span>
      <div className="flex h-32 w-32 items-center justify-center rounded-card border-2 border-border-strong bg-white">
        <img
          src={`${API_ORIGIN}${data.spriteUrl}`}
          alt={data.nameFr}
          className="h-28 w-28 object-contain"
          draggable={false}
        />
      </div>
      <h2 className="font-display text-sm text-primary">{data.nameFr}</h2>
      {data.category && <p className="text-xs font-semibold text-muted">{data.category}</p>}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {data.types.map((t) => (
          <span
            key={t.nameFr}
            className="flex items-center gap-1 rounded-full border-2 border-border-strong bg-surface-2/60 px-2 py-0.5 text-xs font-bold text-foreground"
          >
            {t.image && <img src={t.image} alt="" className="h-3.5 object-contain" />}
            {t.nameFr}
          </span>
        ))}
      </div>
      <div className="flex w-full justify-between gap-2 text-xs font-semibold text-muted">
        <span>Gén. {data.generation}</span>
        {data.height != null && <span>{data.height.toFixed(1)} m</span>}
        {data.weight != null && <span>{data.weight.toFixed(1)} kg</span>}
      </div>
      <div className="flex w-full flex-col gap-1">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-left text-[10px] font-bold text-muted">{s.label}</span>
            <span className="w-7 shrink-0 text-right font-display text-[10px] text-foreground">{s.value}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (s.value / 200) * 100)}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PokedexPage() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [gen, setGen] = useState<number | 'all'>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ['pokedex-catalog'],
    queryFn: getPokedexCatalog,
    staleTime: Infinity,
  });

  const { data: collection } = useQuery({
    queryKey: ['pokedex-collection'],
    queryFn: getPokedexCollection,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  // Ouvrir le Pokédex efface la pastille "nouveau".
  useEffect(() => {
    if (!user) return;
    void markPokedexSeen();
  }, [user]);

  const collectedIds = useMemo(() => new Set(collection?.collectedIds ?? []), [collection]);

  const filtered = useMemo(() => {
    let list = gen === 'all' ? catalog : catalog.filter((p) => p.generation === gen);
    if (ownedOnly) list = list.filter((p) => collectedIds.has(p.id));
    return [...list].sort((a, b) => a.pokedexId - b.pokedexId);
  }, [catalog, gen, ownedOnly, collectedIds]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const setGeneration = (g: number | 'all') => {
    setGen(g);
    setPage(0);
    setSelected(null);
  };

  const toggleOwnedOnly = () => {
    setOwnedOnly((v) => !v);
    setPage(0);
    setSelected(null);
  };

  const onPick = (entry: PokedexCatalogEntry) => {
    if (collectedIds.has(entry.id)) setSelected(entry.id);
  };

  if (initializing) {
    return (
      <AppBackground>
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex flex-1 items-center justify-center">
            <Spinner className="h-7 w-7 text-primary" />
          </main>
        </div>
      </AppBackground>
    );
  }

  if (!user) {
    return (
      <AppBackground>
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex flex-1 items-center justify-center px-4 py-8">
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
              <h1 className="font-display text-sm text-foreground">Pokédex</h1>
              <p className="text-sm font-semibold text-muted">
                Connecte-toi pour collectionner les Pokémon cachés sur le site et suivre ta collection.
              </p>
              <Button className="w-full" onClick={() => navigate('/connexion', { state: { from: '/pokedex' } })}>
                Se connecter
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
            </Card>
          </main>
        </div>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
          {/* En-tete facon centre de donnees */}
          <Card className="flex flex-wrap items-center justify-between gap-3 border-4 border-border-strong p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-danger shadow-[inset_0_0_0_3px_var(--color-surface)]" />
              <div>
                <h1 className="font-display text-sm text-foreground">Pokédex</h1>
                <p className="text-xs font-semibold text-muted">
                  {collection?.collectedCount ?? 0} / {collection?.total ?? catalog.length} capturés
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <FilterChip active={gen === 'all'} onClick={() => setGeneration('all')}>
                Tous
              </FilterChip>
              {GENERATIONS.map((g) => (
                <FilterChip key={g} active={gen === g} onClick={() => setGeneration(g)}>
                  {g}
                </FilterChip>
              ))}
              <button
                type="button"
                onClick={toggleOwnedOnly}
                aria-pressed={ownedOnly}
                className={cn(
                  'ml-1 rounded-control border-2 px-2.5 py-1 font-display text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  ownedOnly
                    ? 'border-go-shadow bg-go text-go-foreground'
                    : 'border-border-strong bg-surface-2/60 text-muted hover:border-primary hover:text-foreground',
                )}
              >
                Possédés
              </button>
            </div>
          </Card>

          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Grille */}
            <Card className="flex-1 border-4 border-border-strong p-3 sm:p-4">
              {catalogLoading ? (
                <Spinner className="mx-auto my-10 h-6 w-6 text-primary" />
              ) : filtered.length === 0 ? (
                <p className="py-10 text-center text-sm font-semibold text-muted">
                  {ownedOnly
                    ? "Tu n'as pas encore capturé de Pokémon ici. Explore le site pour en trouver !"
                    : 'Aucun Pokémon à afficher.'}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {pageItems.map((entry) => {
                      const owned = collectedIds.has(entry.id);
                      const isSelected = selected === entry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onPick(entry)}
                          disabled={!owned}
                          aria-label={owned ? entry.nameFr : `Pokémon ${padId(entry.pokedexId)} non capturé`}
                          className={cn(
                            'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-control border-2 p-1 transition-colors',
                            owned
                              ? 'cursor-pointer border-border-strong bg-white hover:border-primary'
                              : 'border-border-strong/40 bg-surface-2/40',
                            isSelected && 'border-primary ring-2 ring-primary',
                          )}
                        >
                          {owned ? (
                            <img
                              src={`${API_ORIGIN}/api/pokemon/${entry.id}/sprite`}
                              alt={entry.nameFr}
                              className="h-8 w-8 object-contain sm:h-10 sm:w-10"
                              draggable={false}
                            />
                          ) : (
                            <span className="font-display text-[9px] text-muted/50">?</span>
                          )}
                          <span className="font-display text-[7px] text-muted">{padId(entry.pokedexId)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      aria-label="Page précédente"
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-border-strong bg-surface text-foreground transition-colors hover:border-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="font-display text-[10px] text-muted">
                      {safePage + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={safePage >= pageCount - 1}
                      aria-label="Page suivante"
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-border-strong bg-surface text-foreground transition-colors hover:border-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}
            </Card>

            {/* Panneau de detail */}
            <Card className="border-4 border-border-strong p-4 lg:w-72 lg:shrink-0">
              {selected ? (
                <DetailPanel id={selected} />
              ) : (
                <p className="flex h-full min-h-52 items-center justify-center text-center text-sm font-semibold text-muted">
                  Sélectionne un Pokémon capturé pour voir sa fiche.
                </p>
              )}
            </Card>
          </div>
        </main>
      </div>
    </AppBackground>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // min 44px : les filtres de generation etaient a 34x27px, trop petits au doigt.
        'flex min-h-11 min-w-11 items-center justify-center rounded-control border-2 px-3 font-display text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9 sm:min-w-9',
        active
          ? 'border-primary-shadow bg-primary text-primary-foreground'
          : 'border-border-strong bg-surface-2/60 text-muted hover:border-primary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
