import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Search, X } from 'lucide-react';
import type {
  IntruderChoiceResponse,
  IntruderLevel,
  IntruderMemberReveal,
  IntruderRoundState,
} from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { useActiveLevel } from './active-level';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, isDailyCompletedError } from '@/lib/errors';
import { HelpPopover } from '@/components/ui/help-popover';
import { DailyDoneCard } from './components/daily-done-card';
import { LevelSelectScreen, type LevelOption } from './components/level-select-screen';
import { ArenaInstruction } from './components/arena-instruction';
import { TileGrid } from './components/tile-grid';
import { levelColor, LEVEL_BADGE_TEXT, LEVEL_BADGE_TEXT_SHADOW } from './level-colors';
import { getIntruderRound, startIntruder, submitIntruderChoice } from './intruder-api';
import {
  clearIntruder,
  intruderDailyStatus,
  intruderTodayKey,
  loadIntruderDone,
  loadIntruderSaved,
  saveIntruder,
  saveIntruderDone,
} from './intruder-storage';

const INTRUDER_RULES = [
  'Plusieurs Pokémon, tous partagent un point commun sauf un.',
  'Clique sur l’intrus, celui qui ne partage pas ce trait.',
  'Le trait commun change à chaque manche (type, génération, statistique...).',
  '5 manches : vise le meilleur score.',
];

const LEVELS: { level: IntruderLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: '4 cartes, indice explicite' },
  { level: 'MOYEN', label: 'Moyen', description: '5 cartes, domaine indiqué' },
  { level: 'DIFFICILE', label: 'Difficile', description: '6 cartes, indice minimal' },
];

const LEVEL_LABEL: Record<IntruderLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
};

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function IntruderPage() {
  const [level, pickLevel, backToSelect] = useActiveLevel<IntruderLevel>('intruder');

  if (!level) {
    return <IntruderLevelSelect onPick={pickLevel} />;
  }
  return <IntruderGame key={level} level={level} onBack={backToSelect} />;
}

function IntruderLevelSelect({ onPick }: { onPick: (level: IntruderLevel) => void }) {
  const options = useMemo<LevelOption<IntruderLevel>[]>(
    () => LEVELS.map((l) => ({ ...l, status: intruderDailyStatus(l.level) })),
    [],
  );
  return <LevelSelectScreen title="L'Intrus" rules={INTRUDER_RULES} options={options} onPick={onPick} />;
}

function IntruderGame({ level, onBack }: { level: IntruderLevel; onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<IntruderRoundState | null>(null);
  const [reveal, setReveal] = useState<IntruderChoiceResponse | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
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
    setChosenId(null);
    setEnded(false);
    setEndInfo(null);
    try {
      const round = await startIntruder(level);
      setState(round);
      saveIntruder(level, round.roundId, round.roundIndex);
    } catch (err) {
      if (isDailyCompletedError(err)) {
        setAlreadyDone(true);
        return;
      }
      clearIntruder(level);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, [level]);

  const restoreOrStart = useCallback(async () => {
    const today = intruderTodayKey();
    const done = loadIntruderDone(level);
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadIntruderSaved(level);
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getIntruderRound(saved.roundId);
      if (round.status === 'FINISHED') {
        saveIntruderDone(level, round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
        saveIntruder(level, round.roundId, round.roundIndex);
      }
      setLoading(false);
    } catch {
      clearIntruder(level);
      await start();
    }
  }, [level, start]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const revealMap = useMemo(() => {
    const map = new Map<number, IntruderMemberReveal>();
    if (reveal) {
      for (const r of reveal.reveals) map.set(r.pokemonId, r);
    }
    return map;
  }, [reveal]);

  const onChoose = async (pokemonId: number) => {
    if (!state || reveal || busy) return;
    setBusy(true);
    setError(null);
    setChosenId(pokemonId);
    try {
      const res = await submitIntruderChoice(state.roundId, pokemonId);
      setReveal(res);
      if (res.state.status === 'FINISHED') {
        saveIntruderDone(level, res.state.correctCount, res.state.totalRounds);
      }
    } catch (err) {
      setChosenId(null);
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
      saveIntruder(level, next.roundId, next.roundIndex);
      setReveal(null);
      setChosenId(null);
    }
  };

  const renderTile = (pokemonId: number, name: string, spriteUrl: string, index: number) => {
    const info = revealMap.get(pokemonId);
    const isIntruder = info?.isIntruder ?? false;
    const isWrongPick = reveal !== null && chosenId === pokemonId && !isIntruder;

    const revealed = reveal !== null;
    const borderStyle: CSSProperties | undefined = isIntruder
      ? { borderColor: '#5FB24A' }
      : isWrongPick
        ? { borderColor: '#EE1515' }
        : undefined;
    const animate =
      !revealed || reduceMotion
        ? {}
        : isIntruder
          ? { scale: [1, 1.06, 1] }
          : isWrongPick
            ? { x: [0, -6, 6, -4, 4, 0] }
            : {};

    return (
      <motion.button
        key={pokemonId}
        type="button"
        disabled={revealed || busy}
        aria-label={`Choisir ${name}`}
        onClick={() => void onChoose(pokemonId)}
        animate={animate}
        transition={{ duration: 0.45 }}
        style={borderStyle}
        className={cn(
          'relative flex w-full flex-col items-center gap-1.5 overflow-hidden rounded-card border-4 border-border-strong bg-tile p-3 shadow-[0_4px_0_rgba(43,42,36,0.15)] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          !revealed && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 38%, rgba(255,203,5,0.2), rgba(255,203,5,0) 60%)' }}
        />
        <div className="relative h-16 w-16 sm:h-24 sm:w-24">
          <img
            src={`${API_ORIGIN}${spriteUrl}`}
            alt={name}
            className="relative z-10 h-full w-full object-contain"
            draggable={false}
          />
          <span
            aria-hidden
            className="absolute bottom-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px]"
          />
        </div>
        <span className="relative z-10 text-center text-sm font-extrabold text-foreground">{name}</span>
        {info && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.12 }}
            className="relative z-10 flex flex-col items-center gap-1"
          >
            <span
              className={cn(
                'text-center text-xs font-bold',
                isIntruder ? 'text-danger' : 'text-success',
              )}
            >
              {info.detail}
            </span>
            {info.typeImage && (
              <img src={info.typeImage} alt="" className="h-5 object-contain" draggable={false} />
            )}
            {info.megaSpriteUrl && (
              <img
                src={`${API_ORIGIN}${info.megaSpriteUrl}`}
                alt=""
                className="h-12 w-12 object-contain"
                draggable={false}
              />
            )}
          </motion.div>
        )}
        {isIntruder && (
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
              <p className="text-sm font-semibold text-danger">
                {error ?? 'Une erreur est survenue.'}
              </p>
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
                  <h1 className="font-display text-sm leading-relaxed text-foreground">L'Intrus</h1>
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
                  <HelpPopover ariaLabel="Règles de L'Intrus" rules={INTRUDER_RULES} />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <ArenaInstruction icon={<Search className="h-3.5 w-3.5 text-foreground" />}>
                  {state.prompt}
                </ArenaInstruction>
                {state.hint && (
                  <p className="text-center text-sm font-semibold text-primary">{state.hint}</p>
                )}
              </div>

              <TileGrid>
                {state.members.map((m, index) => renderTile(m.pokemonId, m.name, m.spriteUrl, index))}
              </TileGrid>

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
                  <p className="text-center text-sm font-bold text-foreground">{reveal.commonLabel}</p>
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
