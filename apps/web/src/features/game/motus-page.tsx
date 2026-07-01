import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { MotusLetterState, MotusLevel, MotusRoundState } from '@pokegames/shared-types';
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
  motusDailyStatus,
  motusTodayKey,
  saveMotus,
  saveMotusDone,
  type MotusDone,
} from './motus-storage';
import { HelpPopover, type HelpLegendItem } from '@/components/ui/help-popover';
import { LevelSelectScreen } from './components/level-select-screen';
import { MotusGrid } from './components/motus-grid';
import { MotusKeyboard } from './components/motus-keyboard';
import { MotusSkeleton } from './components/motus-skeleton';

const MOTUS_RULES = [
  'Devine le Pokémon du jour, à la Wordle.',
  'Le nombre d’essais et la longueur dépendent du niveau.',
  'Chaque proposition doit être un vrai Pokémon de la même longueur.',
  'La ligne se valide automatiquement une fois pleine.',
];

const MOTUS_LEGEND: HelpLegendItem[] = [
  { className: 'border-go-shadow bg-go text-white', label: 'Bien placée' },
  { className: 'border-accent-shadow bg-accent text-foreground', label: 'Présente, mal placée' },
  { className: 'border-absent-shadow bg-absent text-surface', label: 'Absente du mot' },
];

const STATE_PRIORITY: Record<MotusLetterState, number> = { ABSENT: 0, PRESENT: 1, CORRECT: 2 };

const LEVELS: { level: MotusLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: '5-6 lettres, 1re lettre donnée, 6 essais' },
  { level: 'MOYEN', label: 'Moyen', description: '6-7 lettres, 1re lettre donnée, 5 essais' },
  { level: 'DIFFICILE', label: 'Difficile', description: '5-8 lettres, sans 1re lettre, 6 essais' },
  { level: 'EXTREME', label: 'Extrême', description: '5-9 lettres, sans 1re lettre, 4 essais' },
];

const LEVEL_LABEL: Record<MotusLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
  EXTREME: 'Extrême',
};

export function MotusPage() {
  const [level, setLevel] = useState<MotusLevel | null>(null);

  if (!level) {
    return (
      <LevelSelectScreen
        title="Poké-Motus"
        rules={MOTUS_RULES}
        options={LEVELS.map((l) => ({ ...l, status: motusDailyStatus(l.level) }))}
        onPick={setLevel}
      />
    );
  }
  return <MotusGame key={level} level={level} onBack={() => setLevel(null)} />;
}

function MotusGame({ level, onBack }: { level: MotusLevel; onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<MotusRoundState | null>(null);
  const [doneInfo, setDoneInfo] = useState<MotusDone | null>(null);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [resultReady, setResultReady] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDoneInfo(null);
    setCurrent('');
    setResultReady(false);
    try {
      const round = await startMotus(level);
      setState(round);
      saveMotus(level, round.roundId, round.attempts.length);
    } catch (err) {
      clearMotus(level);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le Motus du jour'));
    } finally {
      setLoading(false);
    }
  }, [level]);

  const restoreOrStart = useCallback(async () => {
    const today = motusTodayKey();
    const done = loadMotusDone(level);
    if (done && done.date === today) {
      setDoneInfo(done);
      setLoading(false);
      return;
    }
    const saved = loadMotusSaved(level);
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
        setResultReady(true);
        saveMotusDone(level, round.status === 'WON', round.answer);
      } else {
        saveMotus(level, round.roundId, round.attempts.length);
      }
      setLoading(false);
    } catch {
      clearMotus(level);
      await start();
    }
  }, [level, start]);

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
            saveMotusDone(level, res.state.status === 'WON', res.state.answer);
            if (reduceMotion) {
              setResultReady(true);
            } else {
              const flipMs = res.state.length * 220 + 300;
              const extraMs = res.state.status === 'WON' ? res.state.length * 80 + 500 : 350;
              window.setTimeout(() => setResultReady(true), flipMs + extraMs);
            }
          } else {
            saveMotus(level, res.state.roundId, res.state.attempts.length);
          }
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'Erreur lors de la validation'));
      } finally {
        setBusy(false);
      }
    },
    [state, busy, reduceMotion, level],
  );

  const addLetter = useCallback(
    (letter: string) => {
      if (!state || state.status !== 'PLAYING' || busy) return;
      setError(null);
      const hasFirstLetter = Boolean(state.firstLetter);
      const maxTyped = hasFirstLetter ? state.length - 1 : state.length;
      if (current.length >= maxTyped) return;
      const next = current + letter;
      setCurrent(next);
      if (next.length === maxTyped) {
        const fullWord = hasFirstLetter ? (state.firstLetter ?? '') + next : next;
        void submit(fullWord);
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
              <Button variant="secondary" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Changer de niveau
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="Changer de niveau"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="font-display text-sm leading-relaxed text-foreground">Poké-Motus</h1>
                    <p className="mt-1 text-sm font-semibold text-muted">{state.length} lettres</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-accent-shadow bg-accent text-foreground">
                    {LEVEL_LABEL[level]}
                  </Badge>
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {attemptsUsed}/{state.maxAttempts}
                  </Badge>
                  <HelpPopover
                    ariaLabel="Règles du Poké-Motus"
                    rules={MOTUS_RULES}
                    legend={MOTUS_LEGEND}
                  />
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
