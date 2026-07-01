import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
import { getApiErrorMessage } from '@/lib/errors';
import { HelpPopover } from '@/components/ui/help-popover';
import { CountUp } from './components/count-up';
import { LevelSelectScreen, type LevelOption } from './components/level-select-screen';
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

    const animate =
      reveal === null || reduceMotion
        ? {}
        : isCorrect
          ? { scale: [1, 1.06, 1] }
          : isWrongPick
            ? { x: [0, -6, 6, -4, 4, 0] }
            : {};

    return (
      <motion.button
        type="button"
        disabled={reveal !== null || busy}
        onClick={() => void onChoose(side)}
        animate={animate}
        transition={{ duration: 0.45 }}
        className={cn(
          'flex flex-1 flex-col items-center gap-2 rounded-card border-4 bg-white p-4 transition-colors duration-150',
          reveal === null && 'cursor-pointer hover:border-primary',
          isCorrect
            ? 'border-go bg-go/10'
            : isWrongPick
              ? 'border-danger bg-danger/10'
              : reveal !== null
                ? 'border-border-strong opacity-70'
                : 'border-border-strong',
        )}
      >
        <img
          src={`${API_ORIGIN}${contestant.spriteUrl}`}
          alt={contestant.name}
          className="h-24 w-24 object-contain sm:h-28 sm:w-28"
          draggable={false}
        />
        <span className="text-center text-sm font-extrabold text-foreground">{contestant.name}</span>
        {value ? (
          <CountUp
            target={value.value}
            format={(n) => formatValue(state.criterion, n)}
            className={cn('font-display text-sm', isCorrect ? 'text-success' : 'text-foreground')}
          />
        ) : (
          <span className="font-display text-xs text-muted">?</span>
        )}
      </motion.button>
    );
  };

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
                  <h1 className="font-display text-sm leading-relaxed text-foreground">Plus ou Moins</h1>
                  <Badge className="border-accent-shadow bg-accent text-foreground">
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

              <p className="text-center font-display text-xs leading-relaxed text-foreground sm:text-sm">
                {state.criterionLabel}
              </p>

              <div className="flex w-full items-stretch justify-center gap-3">
                {renderTile('A')}
                <span className="flex items-center font-display text-sm text-muted">VS</span>
                {renderTile('B')}
              </div>

              {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}

              {reveal && (
                <div className="flex flex-col items-center gap-3">
                  <motion.p
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
