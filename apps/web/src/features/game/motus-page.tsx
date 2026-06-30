import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { MotusLetterState, MotusRoundState } from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/errors';
import { getMotusRound, startMotus, submitMotusGuess } from './motus-api';
import {
  clearMotus,
  loadMotusDone,
  loadMotusSaved,
  motusTodayKey,
  saveMotus,
  saveMotusDone,
  type MotusDone,
} from './motus-storage';
import { MotusGrid } from './components/motus-grid';
import { MotusHelp } from './components/motus-help';
import { MotusKeyboard } from './components/motus-keyboard';
import { MotusSkeleton } from './components/motus-skeleton';

const STATE_PRIORITY: Record<MotusLetterState, number> = { ABSENT: 0, PRESENT: 1, CORRECT: 2 };

export function MotusPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<MotusRoundState | null>(null);
  const [doneInfo, setDoneInfo] = useState<MotusDone | null>(null);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  // Laisse jouer le flip de revelation avant d'afficher l'ecran de fin sur le dernier essai.
  const [resultReady, setResultReady] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDoneInfo(null);
    setCurrent('');
    setResultReady(false);
    try {
      const round = await startMotus();
      setState(round);
      saveMotus(round.roundId);
    } catch (err) {
      clearMotus();
      setError(getApiErrorMessage(err, 'Impossible de démarrer le Motus du jour'));
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreOrStart = useCallback(async () => {
    const today = motusTodayKey();
    const done = loadMotusDone();
    if (done && done.date === today) {
      setDoneInfo(done);
      setLoading(false);
      return;
    }
    const saved = loadMotusSaved();
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getMotusRound(saved.roundId);
      setState(round);
      setCurrent('');
      if (round.status !== 'PLAYING' && round.answer) {
        // Manche deja terminee a la restauration : pas d'animation, ecran de fin direct.
        setResultReady(true);
        saveMotusDone(round.status === 'WON', round.answer);
      }
      setLoading(false);
    } catch {
      clearMotus();
      await start();
    }
  }, [start]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const letterStates = useMemo(() => {
    const map: Record<string, MotusLetterState> = {};
    if (!state) return map;
    for (const row of state.attempts) {
      for (const { letter, state: letterState } of row.letters) {
        const previous = map[letter];
        if (!previous || STATE_PRIORITY[letterState] > STATE_PRIORITY[previous]) {
          map[letter] = letterState;
        }
      }
    }
    return map;
  }, [state]);

  const submit = useCallback(
    async (word: string) => {
      if (!state || state.status !== 'PLAYING' || busy) return;
      setBusy(true);
      try {
        const res = await submitMotusGuess(state.roundId, word);
        if (!res.accepted) {
          setError(res.message ?? "Ce n'est pas un Pokémon valide");
          setShakeKey((k) => k + 1);
        } else {
          setState(res.state);
          setCurrent('');
          setError(null);
          if (res.state.status !== 'PLAYING' && res.state.answer) {
            saveMotusDone(res.state.status === 'WON', res.state.answer);
            if (reduceMotion) {
              setResultReady(true);
            } else {
              // Temps du flip (par lettre) puis de la celebration eventuelle.
              const flipMs = res.state.length * 220 + 300;
              const extraMs = res.state.status === 'WON' ? res.state.length * 80 + 500 : 350;
              window.setTimeout(() => setResultReady(true), flipMs + extraMs);
            }
          }
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'Erreur lors de la validation'));
      } finally {
        setBusy(false);
      }
    },
    [state, busy],
  );

  const addLetter = useCallback(
    (letter: string) => {
      if (!state || state.status !== 'PLAYING' || busy) return;
      setError(null);
      // La premiere lettre est donnee : le joueur ne saisit que les suivantes.
      const maxTyped = state.length - 1;
      if (current.length >= maxTyped) return;
      const next = current + letter;
      setCurrent(next);
      if (next.length === maxTyped) {
        void submit(state.firstLetter + next);
      }
    },
    [state, busy, current, submit],
  );

  const backspace = useCallback(() => {
    setError(null);
    setCurrent((value) => value.slice(0, -1));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        addLetter(event.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addLetter, backspace]);

  const finished =
    doneInfo !== null || (state !== null && state.status !== 'PLAYING' && resultReady);
  const won = state ? state.status === 'WON' : (doneInfo?.won ?? false);
  const answer = state?.answer ?? doneInfo?.answer ?? '';
  const attemptsUsed = state ? state.attempts.length : 0;

  const liveMessage = finished
    ? won
      ? `Gagné en ${attemptsUsed} essai${attemptsUsed > 1 ? 's' : ''}.`
      : `Perdu. Le Pokémon était ${answer}.`
    : attemptsUsed > 0
      ? `Essai ${attemptsUsed} enregistré.`
      : '';

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {loading ? (
            <MotusSkeleton />
          ) : finished ? (
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
              <span
                className={`font-display text-[10px] uppercase tracking-widest ${won ? 'text-success' : 'text-danger'}`}
              >
                {won ? 'Gagné' : 'Perdu'}
              </span>
              <p className="text-sm font-semibold text-muted">
                {won
                  ? `Tu as trouvé le Pokémon du jour${attemptsUsed ? ` en ${attemptsUsed} essai${attemptsUsed > 1 ? 's' : ''}` : ''}.`
                  : "Tu n'as pas trouvé le Pokémon du jour."}
              </p>
              <p className="font-display text-xl text-primary">{answer}</p>
              <p className="text-sm font-semibold text-muted">Reviens demain pour un nouveau mot.</p>
              <Button className="w-full" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
            </Card>
          ) : !state ? (
            <Card className="max-w-md p-6 text-center">
              <p className="text-sm font-semibold text-danger">{error ?? 'Une erreur est survenue.'}</p>
              <Button className="mt-4" onClick={() => void start()}>
                Réessayer
              </Button>
            </Card>
          ) : (
            <Card className="flex w-full max-w-xl flex-col items-center gap-5 p-6">
              <div className="flex w-full items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-sm leading-relaxed text-foreground">Poké-Motus</h1>
                  <p className="mt-1 text-sm font-semibold text-muted">Mot du jour, {state.length} lettres</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {attemptsUsed}/{state.maxAttempts}
                  </Badge>
                  <MotusHelp />
                </div>
              </div>

              <MotusGrid state={state} current={current} shakeKey={shakeKey} />

              {error && (
                <p role="alert" className="text-center text-sm font-semibold text-danger">
                  {error}
                </p>
              )}

              <MotusKeyboard
                letterStates={letterStates}
                disabled={busy}
                onKey={addLetter}
                onBackspace={backspace}
              />
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
