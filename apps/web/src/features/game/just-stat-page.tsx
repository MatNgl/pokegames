import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { JustStatGuessResponse, JustStatRoundState } from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { HelpPopover } from '@/components/ui/help-popover';
import { getJustStatRound, guessJustStat, startJustStat, timeoutJustStat } from './just-stat-api';
import {
  clearJustStat,
  justStatTodayKey,
  loadJustStatDone,
  loadJustStatSaved,
  saveJustStat,
  saveJustStatDone,
} from './just-stat-storage';

const JUST_STAT_RULES = [
  'Devine la valeur exacte de la caractéristique demandée.',
  'À chaque essai : flèche verte (plus haut) ou rouge (plus bas).',
  '20 secondes par manche, sinon la manche est perdue.',
  '3 manches : vise le meilleur score.',
];

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

interface GuessRow {
  value: number;
  direction: 'HIGHER' | 'LOWER';
}

function unitSuffix(unit: string): string {
  return unit ? ` ${unit}` : '';
}

export function JustStatPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<JustStatRoundState | null>(null);
  const [result, setResult] = useState<JustStatGuessResponse | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [input, setInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [ended, setEnded] = useState(false);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<JustStatRoundState | null>(null);
  stateRef.current = state;
  const inputRef = useRef<HTMLInputElement>(null);

  const roundOver = result?.roundOver ?? false;

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setGuesses([]);
    setInput('');
    setEnded(false);
    setEndInfo(null);
    try {
      const round = await startJustStat();
      setState(round);
      saveJustStat(round.roundId);
    } catch (err) {
      clearJustStat();
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreOrStart = useCallback(async () => {
    const today = justStatTodayKey();
    const done = loadJustStatDone();
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadJustStatSaved();
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getJustStatRound(saved.roundId);
      if (round.status === 'FINISHED') {
        saveJustStatDone(round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
      }
      setLoading(false);
    } catch {
      clearJustStat();
      await start();
    }
  }, [start]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const onTimeout = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const res = await timeoutJustStat(current.roundId);
      setResult(res);
      if (res.state.status === 'FINISHED') {
        saveJustStatDone(res.state.correctCount, res.state.totalRounds);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur réseau'));
    } finally {
      setBusy(false);
    }
  }, []);

  // Chrono par manche : un seul effet, cle sur roundId + roundIndex uniquement (pas sur secondsLeft
  // ni sur chaque proposition). Le compteur est initialise en interne, il ne peut donc pas se
  // declencher a zero au montage de la manche.
  const roundKey = state ? `${state.roundId}:${state.roundIndex}` : '';
  useEffect(() => {
    const current = stateRef.current;
    if (!current || current.status !== 'PLAYING' || roundOver || ended) return;
    setSecondsLeft(current.timeLimitSeconds);
    let remaining = current.timeLimitSeconds;
    const id = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        void onTimeout();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [roundKey, roundOver, ended, onTimeout]);

  // Redonne le focus au champ des qu'une manche est jouable (demarrage et apres chaque essai),
  // pour saisir a la suite sans recliquer sur l'input.
  useEffect(() => {
    if (stateRef.current && !roundOver && !busy && !loading) {
      inputRef.current?.focus();
    }
  }, [roundKey, roundOver, busy, loading]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!state || busy || roundOver) return;
    const value = Number.parseInt(input, 10);
    if (!Number.isFinite(value)) {
      setError('Entre un nombre entier.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await guessJustStat(state.roundId, value);
      setResult(res);
      if (res.direction === 'HIGHER' || res.direction === 'LOWER') {
        setGuesses((g) => [...g, { value, direction: res.direction as 'HIGHER' | 'LOWER' }]);
      }
      if (!res.roundOver) {
        setState(res.state);
      } else if (res.state.status === 'FINISHED') {
        saveJustStatDone(res.state.correctCount, res.state.totalRounds);
      }
      setInput('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur lors de la validation'));
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    if (!result) return;
    const next = result.state;
    if (next.status === 'FINISHED') {
      setEndInfo({ correctCount: next.correctCount, totalRounds: next.totalRounds });
      setEnded(true);
    } else {
      setState(next);
      setResult(null);
      setGuesses([]);
      setInput('');
    }
  };

  const solved = result?.direction === 'CORRECT';
  const timeRatio = state ? Math.max(0, secondsLeft) / state.timeLimitSeconds : 0;
  const timeLow = secondsLeft <= 5;

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {loading ? (
            <Spinner className="h-7 w-7 text-primary" />
          ) : ended ? (
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
              <span className="font-display text-[10px] uppercase tracking-widest text-success">
                Défi du jour terminé
              </span>
              <p className="font-display text-2xl text-primary">
                {endInfo?.correctCount ?? 0}/{endInfo?.totalRounds ?? 0}
              </p>
              <p className="text-sm font-bold text-foreground">bonnes réponses</p>
              <p className="text-sm font-semibold text-muted">Reviens demain pour un nouveau défi.</p>
              <Button className="w-full" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
            </Card>
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
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-6">
              <div className="flex w-full items-start justify-between gap-4">
                <h1 className="font-display text-sm leading-relaxed text-foreground">La Juste Stat</h1>
                <div className="flex items-center gap-2">
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {state.roundIndex}/{state.totalRounds}
                  </Badge>
                  <HelpPopover ariaLabel="Règles de La Juste Stat" rules={JUST_STAT_RULES} />
                </div>
              </div>

              {/* Chrono */}
              <div className="w-full">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted">Temps</span>
                  <span
                    className={cn(
                      'font-display text-xs',
                      timeLow ? 'text-danger' : 'text-foreground',
                    )}
                  >
                    {Math.max(0, secondsLeft)} s
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn('h-full transition-all duration-1000 ease-linear', timeLow ? 'bg-danger' : 'bg-go')}
                    style={{ width: `${timeRatio * 100}%` }}
                  />
                </div>
              </div>

              <img
                src={`${API_ORIGIN}${state.pokemon.spriteUrl}`}
                alt={state.pokemon.name}
                className="h-28 w-28 object-contain"
                draggable={false}
                style={{ imageRendering: 'pixelated' }}
              />

              <p className="text-center text-sm font-bold text-foreground">
                Quelle est la {state.statLabel} de{' '}
                <span className="text-primary">{state.pokemon.name}</span> ?
                {state.statUnit ? ` (en ${state.statUnit})` : ''}
              </p>
              <p className="text-xs font-semibold text-muted">
                Indice : entre {state.min} et {state.max}
                {unitSuffix(state.statUnit)}
              </p>

              {guesses.length > 0 && (
                <div className="flex w-full flex-wrap justify-center gap-2">
                  {guesses.map((g, i) => (
                    <span
                      key={`${g.value}-${i}`}
                      className={cn(
                        'flex items-center gap-1 rounded-control border-2 px-2 py-1 text-sm font-bold',
                        g.direction === 'HIGHER'
                          ? 'border-go-shadow bg-go/10 text-success'
                          : 'border-danger bg-danger/10 text-danger',
                      )}
                    >
                      {g.value}
                      {g.direction === 'HIGHER' ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {roundOver ? (
                <div className="flex flex-col items-center gap-3">
                  <motion.p
                    initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                      'font-display text-xs uppercase tracking-widest',
                      solved ? 'text-success' : 'text-danger',
                    )}
                  >
                    {solved ? 'Bien vu !' : 'Raté !'}
                  </motion.p>
                  <p className="text-center text-sm font-bold text-foreground">
                    {state.statLabel} de {state.pokemon.name} :{' '}
                    <span className="text-primary">
                      {result?.correctValue}
                      {unitSuffix(state.statUnit)}
                    </span>
                  </p>
                  <Button onClick={onContinue}>
                    {result?.state.status === 'FINISHED' ? 'Voir le résultat' : 'Manche suivante'}
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="flex w-full flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      type="number"
                      inputMode="numeric"
                      value={input}
                      autoFocus
                      disabled={busy}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ta valeur"
                      aria-label="Valeur proposée"
                    />
                    <Button type="submit" disabled={busy || input.trim() === ''}>
                      {busy ? <Spinner className="h-4 w-4" /> : 'Valider'}
                    </Button>
                  </div>
                  <p className="min-h-5 text-center text-sm font-semibold text-danger">
                    {error ?? ''}
                  </p>
                  <p className="text-center text-xs font-semibold text-muted">
                    {state.attemptsRemaining} essai{state.attemptsRemaining > 1 ? 's' : ''} restant
                    {state.attemptsRemaining > 1 ? 's' : ''}
                  </p>
                </form>
              )}
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
