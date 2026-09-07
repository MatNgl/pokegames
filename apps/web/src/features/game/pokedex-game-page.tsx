import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type {
  PokedexCell,
  PokedexGuessRow,
  PokedexRoundState,
} from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { HelpPopover } from '@/components/ui/help-popover';
import { API_ORIGIN } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, isDailyCompletedError } from '@/lib/errors';
import { getPokemonNames } from './game-api';
import { DailyDoneCard } from './components/daily-done-card';
import { GuessAutocomplete } from './components/guess-autocomplete';
import {
  getPokedexGameState,
  startPokedexGame,
  submitPokedexGuess,
} from './pokedex-game-api';
import {
  clearPokedexGame,
  loadPokedexGameDone,
  loadPokedexGameSaved,
  pokedexGameTodayKey,
  savePokedexGame,
  savePokedexGameDone,
} from './pokedex-game-storage';

const POKEDEX_RULES = [
  'Propose un Pokémon : le tableau compare ses six caractéristiques avec celles du Pokémon mystère.',
  'Vert : la caractéristique correspond. Jaune : elle est proche, ou le type figure dans l’autre emplacement.',
  'Rouge : aucune correspondance.',
  'Une flèche indique de quel côté chercher : vers le haut si le Pokémon mystère a une valeur plus grande.',
];

// Colonnes du tableau, dans l'ordre d'affichage. La cle sert a lire la case dans la ligne.
const COLUMNS = [
  { key: 'type1', label: 'Type 1' },
  { key: 'type2', label: 'Type 2' },
  { key: 'generation', label: 'Génération' },
  { key: 'evolutionStage', label: 'Stade' },
  { key: 'height', label: 'Taille' },
  { key: 'weight', label: 'Poids' },
] as const;

/**
 * Couleurs du verdict. Le vert et le rouge ne se distinguent pas pour une part des joueurs : la
 * fleche des colonnes ordonnees et le libelle toujours visible portent l'information en second.
 */
const VERDICT_STYLE: Record<PokedexCell['verdict'], string> = {
  CORRECT: 'border-go-shadow bg-go text-go-foreground',
  PARTIAL: 'border-accent-shadow bg-accent text-foreground',
  INCORRECT: 'border-danger/70 bg-danger text-white',
};

const VERDICT_LABEL: Record<PokedexCell['verdict'], string> = {
  CORRECT: 'correct',
  PARTIAL: 'partiel',
  INCORRECT: 'incorrect',
};

function VerdictCell({ cell, column }: { cell: PokedexCell; column: string }) {
  const arrow =
    cell.direction === 'HIGHER' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : cell.direction === 'LOWER' ? (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : null;

  const spoken = cell.direction
    ? `, chercher ${cell.direction === 'HIGHER' ? 'plus grand' : 'plus petit'}`
    : '';

  return (
    <td className="p-0.5 sm:p-1">
      <span
        className={cn(
          'flex min-h-11 items-center justify-center gap-1 rounded-control border-2 px-1 text-center text-[11px] font-bold leading-tight shadow-[0_2px_0_rgba(0,0,0,0.18)] sm:text-xs',
          VERDICT_STYLE[cell.verdict],
        )}
      >
        <span className="sr-only">{`${column} : ${cell.label}, ${VERDICT_LABEL[cell.verdict]}${spoken}`}</span>
        <span aria-hidden="true" className="min-w-0 truncate">
          {cell.label}
        </span>
        <span aria-hidden="true">{arrow}</span>
      </span>
    </td>
  );
}

function GuessTable({ guesses }: { guesses: PokedexGuessRow[] }) {
  const reduceMotion = useReducedMotion();

  return (
    // Le tableau defile horizontalement sur mobile : sept colonnes ne tiennent pas dans 375 px.
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-xs">
        <caption className="sr-only">
          Comparaison de chaque Pokémon proposé avec le Pokémon mystère
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface p-1 text-left text-[10px] font-bold uppercase tracking-wide text-muted"
            >
              Pokémon
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="p-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guesses.map((row, index) => (
            <motion.tr
              key={row.pokemonId}
              initial={reduceMotion || index > 0 ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <th scope="row" className="sticky left-0 z-10 bg-surface p-0.5 sm:p-1">
                <span className="flex min-h-11 items-center gap-1.5 rounded-control border-2 border-border-strong bg-surface-2/60 px-1.5">
                  <img
                    src={`${API_ORIGIN}${row.spriteUrl}`}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="min-w-0 truncate text-[11px] font-bold text-foreground sm:text-xs">
                    {row.nameFr}
                  </span>
                </span>
              </th>
              {COLUMNS.map((c) => (
                <VerdictCell key={c.key} cell={row[c.key]} column={c.label} />
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rappel du code couleur, toujours visible : sans lui les cases sont indechiffrables. */
function ColorLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted">
      {(['CORRECT', 'PARTIAL', 'INCORRECT'] as const).map((verdict) => (
        <li key={verdict} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('h-3 w-3 rounded border-2', VERDICT_STYLE[verdict])}
          />
          {verdict === 'CORRECT' ? 'Correct' : verdict === 'PARTIAL' ? 'Proche' : 'Incorrect'}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <ArrowUp className="h-3 w-3" aria-hidden="true" />
        <ArrowDown className="h-3 w-3" aria-hidden="true" />
        Sens de recherche
      </li>
    </ul>
  );
}

export function PokedexGamePage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<PokedexRoundState | null>(null);
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const { data: names = [] } = useQuery({
    queryKey: ['pokemon-names'],
    queryFn: getPokemonNames,
    staleTime: Infinity,
  });

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await startPokedexGame();
      setState(fresh);
      savePokedexGame(fresh.roundId, fresh.attemptsUsed);
    } catch (err) {
      if (isDailyCompletedError(err)) {
        setAlreadyDone(true);
      } else {
        setError(getApiErrorMessage(err, 'Impossible de démarrer le défi'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Restauration : le defi du jour reprend la ou il en etait apres un rechargement.
  useEffect(() => {
    let cancelled = false;
    const boot = async (): Promise<void> => {
      const done = loadPokedexGameDone();
      if (done && done.date === pokedexGameTodayKey()) {
        if (!cancelled) {
          setAlreadyDone(true);
          setLoading(false);
        }
        return;
      }
      const saved = loadPokedexGameSaved();
      if (saved && saved.date === pokedexGameTodayKey()) {
        try {
          const restored = await getPokedexGameState(saved.roundId);
          if (!cancelled) {
            setState(restored);
            setLoading(false);
          }
          return;
        } catch {
          clearPokedexGame(); // session expiree cote serveur : on repart sur un nouveau defi
        }
      }
      if (!cancelled) await start();
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [start]);

  const onGuess = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const name = guess.trim();
    if (!state || busy || !name) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await submitPokedexGuess(state.roundId, name);
      setState(res.state);
      savePokedexGame(res.state.roundId, res.state.attemptsUsed);
      if (!res.accepted) {
        setFeedback(res.message ?? 'Proposition refusée.');
      } else {
        setGuess('');
        if (res.state.status !== 'PLAYING') {
          savePokedexGameDone(res.state.status === 'WON', res.state.attemptsUsed);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’envoyer la proposition'));
    } finally {
      setBusy(false);
    }
  };

  const finished = state != null && state.status !== 'PLAYING';
  const triedNames = (state?.guesses ?? []).map((g) => g.nameFr);
  const remaining = state ? Math.max(0, state.maxAttempts - state.attemptsUsed) : 0;

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-start justify-center px-4 py-8">
          {alreadyDone ? (
            <DailyDoneCard />
          ) : loading ? (
            <Spinner className="mt-16 h-7 w-7 text-primary" />
          ) : !state ? (
            <Card className="max-w-md p-6 text-center">
              <p className="text-sm font-semibold text-danger">
                {error ?? 'Une erreur est survenue.'}
              </p>
              <Button className="mt-4" onClick={() => void start()}>
                Réessayer
              </Button>
            </Card>
          ) : (
            <Card className="flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h1 className="font-display text-sm leading-relaxed text-foreground">Le Pokédex</h1>
                <div className="flex items-center gap-2">
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {state.attemptsUsed}/{state.maxAttempts}
                  </Badge>
                  <HelpPopover title="Le Pokédex" rules={POKEDEX_RULES} />
                </div>
              </div>

              {!finished && (
                <form onSubmit={onGuess} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <GuessAutocomplete
                      value={guess}
                      names={names}
                      excluded={triedNames}
                      disabled={busy}
                      onChange={setGuess}
                    />
                    <Button type="submit" disabled={busy || !guess.trim()}>
                      {busy ? <Spinner className="h-4 w-4" /> : 'Valider'}
                    </Button>
                  </div>
                  <p
                    role="alert"
                    aria-live="assertive"
                    className="min-h-5 text-center text-sm font-semibold text-danger"
                  >
                    {feedback ?? error ?? ''}
                  </p>
                  <p className="text-center text-xs font-semibold text-muted">
                    {remaining > 1
                      ? `${remaining} essais restants`
                      : `${remaining} essai restant`}
                  </p>
                </form>
              )}

              {finished && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 rounded-card border-2 border-border-strong bg-surface-2/50 p-4 text-center"
                >
                  <span
                    className={cn(
                      'font-display text-[10px] uppercase tracking-widest',
                      state.status === 'WON' ? 'text-success' : 'text-danger',
                    )}
                  >
                    {state.status === 'WON' ? 'Trouvé' : 'Perdu'}
                  </span>
                  {state.answer && (
                    <>
                      <img
                        src={`${API_ORIGIN}${state.answer.spriteUrl}`}
                        alt={state.answer.nameFr}
                        draggable={false}
                        className="h-24 w-24 object-contain"
                      />
                      <p className="font-display text-sm text-primary">{state.answer.nameFr}</p>
                    </>
                  )}
                  <p className="text-sm font-semibold text-muted">
                    {state.status === 'WON'
                      ? `Trouvé en ${state.attemptsUsed} essai${state.attemptsUsed > 1 ? 's' : ''}.`
                      : 'Reviens demain pour un nouveau Pokémon.'}
                  </p>
                  <Button className="w-full" onClick={() => navigate('/')}>
                    Retour à l&apos;accueil
                  </Button>
                </motion.div>
              )}

              {state.guesses.length > 0 ? (
                <>
                  <GuessTable guesses={state.guesses} />
                  <ColorLegend />
                </>
              ) : (
                <p className="py-6 text-center text-sm font-semibold text-muted">
                  Propose un premier Pokémon : le tableau se remplira avec ce qui correspond, ou pas,
                  au Pokémon mystère du jour.
                </p>
              )}
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
