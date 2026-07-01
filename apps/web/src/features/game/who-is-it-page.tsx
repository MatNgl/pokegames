import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type {
  WhoIsItGuessResponse,
  WhoIsItHintType,
  WhoIsItLevel,
  WhoIsItRoundState,
} from '@pokegames/shared-types';
import { AppHeader } from '@/components/layout/app-header';
import { AppBackground } from '@/components/backgrounds/app-background';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { getApiErrorMessage, isDailyCompletedError } from '@/lib/errors';
import {
  getPokemonNames,
  getRoundState,
  requestHint,
  startRound,
  submitGuess,
} from './game-api';
import {
  clearSavedGame,
  loadDailyDone,
  loadSavedGame,
  saveDailyDone,
  saveGame,
  todayKey,
  whoIsItDailyStatus,
} from './daily-storage';
import { GuessAutocomplete } from './components/guess-autocomplete';
import { HintIcons } from './components/hint-icons';
import { LevelSelectScreen } from './components/level-select-screen';
import { RoundResult } from './components/round-result';
import { SilhouetteStage } from './components/silhouette-stage';
import { WhoIsItSkeleton } from './components/who-is-it-skeleton';
import { DailyDoneCard } from './components/daily-done-card';

const TOTAL_ROUNDS = 5;

const WHO_IS_IT_RULES = [
  'Devine le Pokémon caché derrière la silhouette.',
  'Chaque mauvaise réponse débloque un nouvel indice.',
  'On compte les essais, pas de points : vise le minimum.',
  'Saisie libre avec autocomplétion (flèches puis Entrée).',
];

const LEVELS: { level: WhoIsItLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: 'Générations 1 à 3, silhouette plein cadre' },
  { level: 'MOYEN', label: 'Moyen', description: 'Toutes générations, zoom' },
  { level: 'DIFFICILE', label: 'Difficile', description: 'Zoom et rotation' },
  { level: 'EXTREME', label: 'Extrême', description: 'Zoom fort, angle aléatoire' },
];

const LEVEL_LABEL: Record<WhoIsItLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
  EXTREME: 'Extrême',
};

export function WhoIsItPage() {
  const [level, setLevel] = useState<WhoIsItLevel | null>(null);

  if (!level) {
    return (
      <LevelSelectScreen
        title="Quel est ce Pokémon ?"
        rules={WHO_IS_IT_RULES}
        options={LEVELS.map((l) => ({ ...l, status: whoIsItDailyStatus(l.level) }))}
        onPick={setLevel}
      />
    );
  }
  return <WhoIsItGame key={level} level={level} onBack={() => setLevel(null)} />;
}

function WhoIsItGame({ level, onBack }: { level: WhoIsItLevel; onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [round, setRound] = useState<WhoIsItRoundState | null>(null);
  const [result, setResult] = useState<WhoIsItGuessResponse | null>(null);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [guess, setGuess] = useState('');
  const [tried, setTried] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [spriteVersion, setSpriteVersion] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [revealReady, setRevealReady] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const { data: names = [] } = useQuery({
    queryKey: ['pokemon-names'],
    queryFn: getPokemonNames,
    staleTime: Infinity,
  });

  const finishGame = useCallback(
    (finalAttempts: number) => {
      setTotalAttempts(finalAttempts);
      setGameOver(true);
      setResult(null);
      clearSavedGame(level);
      saveDailyDone(level, { date: todayKey(), totalAttempts: finalAttempts });
    },
    [level],
  );

  const startManche = useCallback(
    async (roundIndex: number, carriedAttempts: number) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setRevealReady(false);
      setShakeKey(0);
      setFeedback(null);
      setGuess('');
      setTried([]);
      setGameOver(false);
      try {
        // Mode quotidien : serie deterministe du jour, identique pour tous, propre au niveau.
        const state = await startRound({ mode: 'DAILY', level, roundsCount: TOTAL_ROUNDS, roundIndex });
        setRound(state);
        setTotalAttempts(carriedAttempts);
        saveGame(level, {
          date: todayKey(),
          roundId: state.roundId,
          tried: [],
          totalAttempts: carriedAttempts,
          roundIndex: state.roundIndex,
        });
        setSpriteVersion((v) => v + 1);
      } catch (err) {
        if (isDailyCompletedError(err)) {
          setAlreadyDone(true);
          return;
        }
        clearSavedGame(level);
        setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
      } finally {
        setLoading(false);
      }
    },
    [level],
  );

  const restoreOrStart = useCallback(async () => {
    const today = todayKey();

    const done = loadDailyDone(level);
    if (done && done.date === today) {
      setTotalAttempts(done.totalAttempts);
      setGameOver(true);
      setLoading(false);
      return;
    }

    const saved = loadSavedGame(level);
    if (!saved || saved.date !== today) {
      clearSavedGame(level);
      void startManche(1, 0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const state = await getRoundState(saved.roundId);
      if (state.status === 'PLAYING') {
        setRound(state);
        setResult(null);
        setFeedback(null);
        setGuess('');
        setTried(saved.tried);
        setTotalAttempts(saved.totalAttempts);
        setGameOver(false);
        setSpriteVersion((v) => v + 1);
        setLoading(false);
      } else {
        const carried = saved.totalAttempts + state.mistakesCount + 1;
        if (state.roundIndex >= state.totalRounds) {
          finishGame(carried);
          setLoading(false);
        } else {
          void startManche(state.roundIndex + 1, carried);
        }
      }
    } catch {
      clearSavedGame(level);
      void startManche(1, 0);
    }
  }, [level, startManche, finishGame]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const solved = result?.status === 'SOLVED';
  const spriteUrl = round ? `${API_ORIGIN}${round.spriteProxyUrl}?v=${spriteVersion}` : '';
  const isLastRound = round ? round.roundIndex >= round.totalRounds : false;
  const liveAttempts = round ? totalAttempts + round.mistakesCount : totalAttempts;

  const onGuess = async (event: FormEvent) => {
    event.preventDefault();
    if (!round || !guess.trim() || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const attempt = guess.trim();
      const res = await submitGuess(round.roundId, attempt);
      if (res.isCorrect) {
        setResult(res);
        setSpriteVersion((v) => v + 1);
        if (reduceMotion) {
          setRevealReady(true);
        } else {
          window.setTimeout(() => setRevealReady(true), 650);
        }
      } else {
        const nextTried = [...tried, attempt];
        setTried(nextTried);
        setRound({
          ...round,
          currentScore: res.currentScore,
          mistakesCount: res.mistakesCount,
          hints: res.hints,
          zoomRatio: res.zoomRatio ?? round.zoomRatio,
          rotationAngle: res.rotationAngle ?? round.rotationAngle,
        });
        saveGame(level, {
          date: todayKey(),
          roundId: round.roundId,
          tried: nextTried,
          totalAttempts,
          roundIndex: round.roundIndex,
        });
        setFeedback(res.message ?? "Ce n'est pas le bon Pokémon.");
        setShakeKey((k) => k + 1);
        setGuess('');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur lors de la validation'));
    } finally {
      setBusy(false);
    }
  };

  const onReveal = async (type: WhoIsItHintType) => {
    if (!round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const state = await requestHint(round.roundId, type);
      setRound(state);
      if (type === 'BLURRED_COLOR') {
        setSpriteVersion((v) => v + 1);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Indice indisponible'));
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (!round || !result) return;
    const carried = totalAttempts + result.mistakesCount + 1;
    if (round.roundIndex >= round.totalRounds) {
      finishGame(carried);
    } else {
      void startManche(round.roundIndex + 1, carried);
    }
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {alreadyDone ? (
            <DailyDoneCard onBack={onBack} />
          ) : loading ? (
            <WhoIsItSkeleton />
          ) : gameOver ? (
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
              <span className="font-display text-[10px] uppercase tracking-widest text-success">
                Défi du jour terminé
              </span>
              <p className="text-sm font-semibold text-muted">
                Tu as deviné les {TOTAL_ROUNDS} Pokémon. Reviens demain pour un nouveau défi.
              </p>
              <p className="font-display text-2xl text-primary">{totalAttempts}</p>
              <p className="text-sm font-bold text-foreground">
                essai{totalAttempts > 1 ? 's' : ''} au total
              </p>
              <Button className="w-full" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
              <Button variant="secondary" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Changer de niveau
              </Button>
            </Card>
          ) : !round ? (
            <Card className="max-w-md p-6 text-center">
              <p className="text-sm font-semibold text-danger">{error ?? 'Une erreur est survenue.'}</p>
              <Button className="mt-4" onClick={() => void startManche(1, 0)}>
                Réessayer
              </Button>
            </Card>
          ) : (
            <Card className="flex w-full max-w-xl flex-col gap-4 p-4 sm:gap-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
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
                    <h1 className="font-display text-sm leading-relaxed text-foreground">
                      Quel est ce Pokémon ?
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {liveAttempts} essai{liveAttempts > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-accent-shadow bg-accent text-foreground">
                    {LEVEL_LABEL[level]}
                  </Badge>
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {round.roundIndex}/{round.totalRounds}
                  </Badge>
                  <HelpPopover ariaLabel="Règles du jeu" rules={WHO_IS_IT_RULES} />
                </div>
              </div>

              <div className="flex flex-col items-center gap-5">
                <div className="flex w-full flex-wrap items-center justify-center gap-4">
                  <SilhouetteStage
                    src={spriteUrl}
                    revealed={solved}
                    shakeKey={shakeKey}
                    zoomRatio={round.zoomRatio ?? 1}
                    rotationAngle={round.rotationAngle ?? 0}
                  />
                  {!solved && (
                    <HintIcons
                      hints={round.hints}
                      mistakes={round.mistakesCount}
                      busy={busy}
                      onReveal={(type) => void onReveal(type)}
                    />
                  )}
                </div>

                {solved ? (
                  revealReady && result ? (
                    <RoundResult
                      result={result}
                      onNext={advance}
                      nextLabel={isLastRound ? 'Voir le résultat' : 'Manche suivante'}
                    />
                  ) : null
                ) : (
                  <form onSubmit={onGuess} className="mx-auto flex w-full max-w-md flex-col gap-2">
                    <div className="flex gap-2">
                      <GuessAutocomplete
                        value={guess}
                        names={names}
                        excluded={tried}
                        disabled={busy}
                        onChange={setGuess}
                      />
                      <Button type="submit" disabled={busy || !guess.trim()}>
                        {busy ? <Spinner className="h-4 w-4" /> : 'Valider'}
                      </Button>
                    </div>
                    <p role="alert" aria-live="assertive" className="min-h-5 text-center text-sm font-semibold text-danger">
                      {feedback ?? error ?? ''}
                    </p>
                  </form>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
