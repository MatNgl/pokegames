import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, Check, X } from 'lucide-react';
import type {
  PlusMinusChoiceResponse,
  PlusMinusCriterion,
  PlusMinusLevel,
  PlusMinusRoundState,
} from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, isDailyCompletedError } from '@/lib/errors';
import { HelpPopover } from '@/components/ui/help-popover';
import { CountUp } from './components/count-up';
import { DailyDoneCard } from './components/daily-done-card';
import { LevelSelectScreen, type LevelOption } from './components/level-select-screen';
import { ArenaInstruction } from './components/arena-instruction';
import { levelColor, LEVEL_BADGE_TEXT, LEVEL_BADGE_TEXT_SHADOW } from './level-colors';
import { getPlusMinusRound, startPlusMinus, submitPlusMinusChoice } from './plus-minus-api';
import {
  clearPlusMinus,
  loadPlusMinusDone,
  loadPlusMinusSaved,
  plusMinusDailyStatus,
  plusMinusTodayKey,
  savePlusMinus,
  savePlusMinusDone,
} from './plus-minus-storage';

const PLUS_MINUS_RULES = [
  'Deux Pokémon, une question par manche.',
  'Clique sur celui qui a la plus grande valeur.',
  'La caractéristique change à chaque manche.',
  '10 manches : vise le meilleur score.',
];

const LEVELS: { level: PlusMinusLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: 'Écart large, facile à trancher' },
  { level: 'MOYEN', label: 'Moyen', description: 'Écart modéré' },
  { level: 'DIFFICILE', label: 'Difficile', description: 'Écart faible' },
  { level: 'EXTREME', label: 'Extrême', description: 'Valeurs très proches' },
];

const LEVEL_LABEL: Record<PlusMinusLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
  EXTREME: 'Extrême',
};

function formatValue(criterion: PlusMinusCriterion, value: number): string {
  switch (criterion) {
    case 'HEIGHT':
      return `${value.toFixed(1)} m`;
    case 'WEIGHT':
      return `${value.toFixed(1)} kg`;
    case 'AGE':
      return `No ${Math.round(value)}`;
    default:
      return String(Math.round(value));
  }
}

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function PlusMinusPage() {
  const [level, setLevel] = useState<PlusMinusLevel | null>(null);

  if (!level) {
    return <PlusMinusLevelSelect onPick={setLevel} />;
  }
  return <PlusMinusGame key={level} level={level} onBack={() => setLevel(null)} />;
}

function PlusMinusLevelSelect({ onPick }: { onPick: (level: PlusMinusLevel) => void }) {
  const options = useMemo<LevelOption<PlusMinusLevel>[]>(
    () => LEVELS.map((l) => ({ ...l, status: plusMinusDailyStatus(l.level) })),
    [],
  );
  return (
    <LevelSelectScreen title="Plus ou Moins" rules={PLUS_MINUS_RULES} options={options} onPick={onPick} />
  );
}

function PlusMinusGame({ level, onBack }: { level: PlusMinusLevel; onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<PlusMinusRoundState | null>(null);
  const [reveal, setReveal] = useState<PlusMinusChoiceResponse | null>(null);
  const [chosen, setChosen] = useState<'A' | 'B' | null>(null);
  const [ended, setEnded] = useState(false);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReveal(null);
    setChosen(null);
    setEnded(false);
    setEndInfo(null);
    try {
      const round = await startPlusMinus(level);
      setState(round);
      savePlusMinus(level, round.roundId, round.roundIndex);
    } catch (err) {
      if (isDailyCompletedError(err)) {
        setAlreadyDone(true);
        return;
      }
      clearPlusMinus(level);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, [level]);

  const restoreOrStart = useCallback(async () => {
    const today = plusMinusTodayKey();
    const done = loadPlusMinusDone(level);
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadPlusMinusSaved(level);
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getPlusMinusRound(saved.roundId);
      if (round.status === 'FINISHED') {
        savePlusMinusDone(level, round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
        savePlusMinus(level, round.roundId, round.roundIndex);
      }
      setLoading(false);
    } catch {
      clearPlusMinus(level);
      await start();
    }
  }, [level, start]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const onChoose = async (choice: 'A' | 'B') => {
    if (!state || reveal || busy) return;
    setBusy(true);
    setError(null);
    setChosen(choice);
    try {
      const res = await submitPlusMinusChoice(state.roundId, choice);
      setReveal(res);
      if (res.state.status === 'FINISHED') {
        savePlusMinusDone(level, res.state.correctCount, res.state.totalRounds);
      }
    } catch (err) {
      setChosen(null);
      setError(getApiErrorMessage(err, 'Erreur lors du choix'));
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    if (!reveal) return;
    const next = reveal.state;
    if (next.status === 'FINISHED') {
      setEndInfo({ correctCount: next.correctCount, totalRounds: next.totalRounds });
      setEnded(true);
    } else {
      setState(next);
      savePlusMinus(level, next.roundId, next.roundIndex);
      setReveal(null);
      setChosen(null);
    }
  };

  const renderTile = (side: 'A' | 'B') => {
    if (!state) return null;
    const contestant = side === 'A' ? state.a : state.b;
    const value = reveal ? (side === 'A' ? reveal.revealA : reveal.revealB) : null;
    const isCorrect = reveal !== null && reveal.correctChoice === side;
    const isWrongPick = reveal !== null && chosen === side && reveal.correctChoice !== side;

    const revealed = reveal !== null;
    const borderStyle: CSSProperties | undefined = isCorrect
      ? { borderColor: '#5FB24A' }
      : isWrongPick
        ? { borderColor: '#EE1515' }
        : undefined;
    const animate =
      !revealed || reduceMotion
        ? {}
        : isCorrect
          ? { scale: [1, 1.06, 1] }
          : isWrongPick
            ? { x: [0, -6, 6, -4, 4, 0] }
            : {};

    return (
      <motion.button
        type="button"
        disabled={revealed || busy}
        aria-label={`Choisir ${contestant.name}`}
        onClick={() => void onChoose(side)}
        animate={animate}
        transition={{ duration: 0.45 }}
        style={borderStyle}
        className={cn(
          'relative flex flex-1 flex-col items-center gap-2 overflow-hidden rounded-card border-4 border-border-strong bg-tile p-4 shadow-[0_4px_0_rgba(43,42,36,0.15)] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          !revealed && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary',
          revealed && !isCorrect && !isWrongPick && 'opacity-60',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 38%, rgba(255,203,5,0.2), rgba(255,203,5,0) 60%)' }}
        />
        <div className="relative h-24 w-24 sm:h-28 sm:w-28">
          <img
            src={`${API_ORIGIN}${contestant.spriteUrl}`}
            alt={contestant.name}
            className="relative z-10 h-full w-full object-contain"
            draggable={false}
          />
          <span
            aria-hidden
            className="absolute bottom-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px]"
          />
        </div>
        <span className="relative z-10 text-center text-sm font-extrabold text-foreground">
          {contestant.name}
        </span>
        {value ? (
          <CountUp
            target={value.value}
            format={(n) => formatValue(state.criterion, n)}
            className={cn('relative z-10 font-display text-sm', isCorrect ? 'text-success' : 'text-foreground')}
          />
        ) : (
          <span className="relative z-10 font-display text-xs text-muted">?</span>
        )}
        {isCorrect && (
          <span className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-go-shadow bg-go text-go-foreground">
            <Check className="h-4 w-4" />
          </span>
        )}
        {isWrongPick && (
          <span className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-danger bg-danger text-white">
            <X className="h-4 w-4" />
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {alreadyDone ? (
            <DailyDoneCard onBack={onBack} />
          ) : loading ? (
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
            <Card className="flex w-full max-w-xl flex-col items-center gap-4 p-4 sm:gap-5 sm:p-6">
              <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="Changer de niveau"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="font-display text-sm leading-relaxed text-foreground">Plus ou Moins</h1>
                  <Badge
                    style={
                      {
                        borderColor: levelColor(state.level),
                        backgroundColor: levelColor(state.level),
                        color: LEVEL_BADGE_TEXT,
                        textShadow: LEVEL_BADGE_TEXT_SHADOW,
                      } as CSSProperties
                    }
                  >
                    {LEVEL_LABEL[state.level]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {state.roundIndex}/{state.totalRounds}
                  </Badge>
                  <HelpPopover ariaLabel="Règles de Plus ou Moins" rules={PLUS_MINUS_RULES} />
                </div>
              </div>

              <ArenaInstruction icon={<ArrowUpDown className="h-3.5 w-3.5 text-foreground" />}>
                {state.criterionLabel}
              </ArenaInstruction>

              <div className="flex w-full items-stretch justify-center gap-3">
                {renderTile('A')}
                <span className="flex items-center font-display text-sm text-muted">VS</span>
                {renderTile('B')}
              </div>

              {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}

              {reveal && (
                <div className="flex flex-col items-center gap-3">
                  <motion.p
                    role="status"
                    aria-live="polite"
                    initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                      'font-display text-xs uppercase tracking-widest',
                      reveal.correct ? 'text-success' : 'text-danger',
                    )}
                  >
                    {reveal.correct ? 'Bien vu !' : 'Raté !'}
                  </motion.p>
                  <Button onClick={onContinue}>
                    {reveal.state.status === 'FINISHED' ? 'Voir le résultat' : 'Manche suivante'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
