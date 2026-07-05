import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import type { PokedexCollectResponse, PokedexSpawnDTO } from '@pokegames/shared-types';
import { API_ORIGIN } from '@/lib/env';
import { collectSpawn, getSpawns, ROUTE_ZONE } from './pokedex-api';

// Couche globale des easter eggs : une petite silhouette cachée par zone (écran), fixe pour la
// journée. Cliquer la collecte et l'ajoute au Pokédex (ou invite à se connecter pour un invité).
export function EasterEggLayer() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState<PokedexCollectResponse | null>(null);

  const zone = ROUTE_ZONE[location.pathname];

  const { data: spawns = [] } = useQuery({
    queryKey: ['pokedex-spawns'],
    queryFn: getSpawns,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (token: string) => collectSpawn(token),
    onSuccess: (res, token) => {
      setCollected((prev) => new Set(prev).add(token));
      setReveal(res);
      void queryClient.invalidateQueries({ queryKey: ['pokedex-spawns'] });
      void queryClient.invalidateQueries({ queryKey: ['pokedex-collection'] });
    },
  });

  // Apparition de la zone courante, non encore collectée localement.
  const spawn: PokedexSpawnDTO | undefined = zone
    ? spawns.find((s) => s.zone === zone && !collected.has(s.token))
    : undefined;

  return (
    <>
      {spawn && (
        <motion.button
          key={spawn.token}
          type="button"
          onClick={() => mutation.mutate(spawn.token)}
          disabled={mutation.isPending}
          aria-label="Pokémon caché à collecter"
          title="Un Pokémon se cache ici, clique pour le collecter"
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={
            reduce
              ? { opacity: 1 }
              : { scale: 1, opacity: 1, y: [0, -6, 0] }
          }
          transition={
            reduce
              ? undefined
              : { y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: 0.3 } }
          }
          className="fixed bottom-4 left-4 z-40 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border-strong bg-surface/80 p-1.5 shadow-lg backdrop-blur transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <img
            src={`${API_ORIGIN}${spawn.spriteProxyUrl}`}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
            <Sparkles className="h-3 w-3 text-foreground" />
          </span>
        </motion.button>
      )}

      {reveal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setReveal(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative flex w-full max-w-xs flex-col items-center gap-3 rounded-card border-4 border-border-strong bg-surface p-6 text-center shadow-xl"
          >
            <button
              type="button"
              onClick={() => setReveal(null)}
              aria-label="Fermer"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" />
            </button>
            {reveal.pokemon ? (
              <>
                <span className="font-display text-[10px] uppercase tracking-widest text-success">
                  Pokémon trouvé !
                </span>
                <img
                  src={`${API_ORIGIN}${reveal.pokemon.spriteUrl}`}
                  alt={reveal.pokemon.nameFr}
                  className="h-28 w-28 object-contain"
                  draggable={false}
                />
                <p className="font-display text-lg text-primary">{reveal.pokemon.nameFr}</p>
                <p className="text-xs font-semibold text-muted">
                  N°{String(reveal.pokemon.pokedexId).padStart(4, '0')} · Génération {reveal.pokemon.generation}
                </p>
                {reveal.requiresLogin ? (
                  <p className="text-sm font-semibold text-muted">
                    <Link to="/connexion" className="text-primary underline">
                      Connecte-toi
                    </Link>{' '}
                    pour l'ajouter à ton Pokédex.
                  </p>
                ) : reveal.collected ? (
                  <p className="text-sm font-bold text-go-shadow">Ajouté à ton Pokédex.</p>
                ) : (
                  <p className="text-sm font-semibold text-muted">Tu l'avais déjà.</p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-muted">Ce Pokémon a déjà été collecté.</p>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
