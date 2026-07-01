import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles } from 'lucide-react';
import type {
  ShinyChoiceResponse,
  ShinyMode,
  ShinyRoundState,
  ShinyTileReveal,
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
import { getShinyRound, startShiny, submitShinyChoice } from './shiny-api';
import {
  clearShiny,
  loadShinyDone,
  loadShinySaved,
  saveShiny,
  saveShinyDone,
  shinyTodayKey,
} from './shiny-storage';

interface ShinyPageProps {
  mode: ShinyMode;
}

const MODE_TITLE: Record<ShinyMode, string> = {
  FIND_SHINY: 'Trouve le shiny',
  FIND_NON_SHINY: 'Trouve le non shiny',
};

const MODE_RULES: Record<ShinyMode, string[]> = {
  FIND_SHINY: [
    'Trois Pokémon, un seul est shiny (couleur chromatique).',
    'Clique sur celui qui est shiny.',
    'Aucun chrono, mais 10 manches : vise le meilleur score.',
  ],
  FIND_NON_SHINY: [
    'Trois Pokémon, deux sont shiny.',
    'Clique sur celui qui n’est PAS shiny (couleur normale).',
    'Aucun chrono, mais 10 manches : vise le meilleur score.',
  ],
};

const OTHER_MODE: Record<ShinyMode, { mode: ShinyMode; route: string }> = {
  FIND_SHINY: { mode: 'FIND_NON_SHINY', route: '/non-shiny' },
  FIND_NON_SHINY: { mode: 'FIND_SHINY', route: '/shiny' },
};

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function ShinyPage({ mode }: ShinyPageProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<ShinyRoundState | null>(null);
  const [reveal, setReveal] = useState<ShinyChoiceResponse | null>(null);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReveal(null);
    setChosenSlot(null);
    setEnded(false);
    setEndInfo(null);
    try {
      const round = await startShiny(mode);
      setState(round);
      saveShiny(mode, round.roundId);
    } catch (err) {
      clearShiny(mode);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const restoreOrStart = useCallback(async () => {
    const today = shinyTodayKey();
    const done = loadShinyDone(mode);
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadShinySaved(mode);
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getShinyRound(saved.roundId);
      if (round.status === 'FINISHED') {
        saveShinyDone(mode, round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
      }
      setLoading(false);
    } catch {
      clearShiny(mode);
      await start();
    }
  }, [mode, start]);

  useEffect(() => {
    setState(null);
    setReveal(null);
    setChosenSlot(null);
    void restoreOrStart();
  }, [restoreOrStart]);

  const revealMap = useMemo(() => {
    const map = new Map<number, ShinyTileReveal>();
    if (reveal) {
      for (const r of reveal.reveals) map.set(r.slot, r);
    }
    return map;
  }, [reveal]);

  const onChoose = async (slot: number) => {
    if (!state || reveal || busy) return;
    setBusy(true);
    setError(null);
    setChosenSlot(slot);
    try {
      const res = await submitShinyChoice(state.roundId, slot);
      setReveal(res);
      if (res.state.status === 'FINISHED') {
        saveShinyDone(mode, res.state.correctCount, res.state.totalRounds);
      }
    } catch (err) {
      setChosenSlot(null);
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
      setReveal(null);
      setChosenSlot(null);
    }
  };

  const renderTile = (slot: number, imageUrl: string) => {
    const info = revealMap.get(slot);
    const isAnswer = info?.isAnswer ?? false;
    const isWrongPick = reveal !== null && chosenSlot === slot && !isAnswer;

    const animate =
      reveal === null || reduceMotion
        ? {}
        : isAnswer
          ? { scale: [1, 1.06, 1] }
          : isWrongPick
            ? { x: [0, -6, 6, -4, 4, 0] }
            : {};

    return (
      <motion.button
        key={imageUrl}
        type="button"
        disabled={reveal !== null || busy}
        onClick={() => void onChoose(slot)}
        animate={animate}
        transition={{ duration: 0.45 }}
        className={cn(
          'relative flex flex-col items-center gap-1.5 rounded-card border-4 bg-white p-3 transition-colors duration-150',
          reveal === null && 'cursor-pointer hover:border-primary',
          isAnswer
            ? 'border-go bg-go/10'
            : isWrongPick
              ? 'border-danger bg-danger/10'
              : reveal !== null
                ? 'border-border-strong opacity-70'
                : 'border-border-strong',
        )}
      >
        {info?.isShiny && (
          <Sparkles className="absolute right-1.5 top-1.5 h-4 w-4 text-accent" aria-hidden="true" />
        )}
        <img
          src={`${API_ORIGIN}${imageUrl}`}
          alt=""
          className="h-20 w-20 object-contain sm:h-24 sm:w-24"
          draggable={false}
          style={{ imageRendering: 'pixelated' }}
        />
        {info ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-0.5"
          >
            <span className="text-center text-sm font-extrabold text-foreground">{info.name}</span>
            <span
              className={cn(
                'text-xs font-bold',
                info.isShiny ? 'text-accent-shadow' : 'text-muted',
              )}
            >
              {info.isShiny ? 'Shiny' : 'Normal'}
            </span>
          </motion.div>
        ) : (
          <span className="font-display text-[10px] text-muted">?</span>
        )}
      </motion.button>
    );
  };

  const other = OTHER_MODE[mode];

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
              <button
                type="button"
                onClick={() => navigate(other.route)}
                className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                <RefreshCw className="h-4 w-4" />
                {MODE_TITLE[other.mode]}
              </button>
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
            <Card className="flex w-full max-w-xl flex-col items-center gap-5 p-6">
              <div className="flex w-full items-start justify-between gap-4">
                <h1 className="font-display text-sm leading-relaxed text-foreground">
                  {MODE_TITLE[mode]}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(other.route)}
                    aria-label={`Passer au mode ${MODE_TITLE[other.mode]}`}
                    title={MODE_TITLE[other.mode]}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                  <Badge className="border-primary bg-primary text-primary-foreground">
                    {state.roundIndex}/{state.totalRounds}
                  </Badge>
                  <HelpPopover ariaLabel={`Règles de ${MODE_TITLE[mode]}`} rules={MODE_RULES[mode]} />
                </div>
              </div>

              <p className="text-center font-display text-xs leading-relaxed text-foreground sm:text-sm">
                {state.prompt}
              </p>

              <div className="grid w-full grid-cols-3 gap-3">
                {state.tiles.map((tile) => renderTile(tile.slot, tile.imageUrl))}
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
