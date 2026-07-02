import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import type {
  ShinyChoiceResponse,
  ShinyLevel,
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
import { getApiErrorMessage, isDailyCompletedError } from '@/lib/errors';
import { HelpPopover } from '@/components/ui/help-popover';
import { DailyDoneCard } from './components/daily-done-card';
import { LevelSelectScreen, type LevelOption } from './components/level-select-screen';
import { ArenaInstruction } from './components/arena-instruction';
import { PokemonTile, type TileResult } from './components/pokemon-tile';
import { TileGrid } from './components/tile-grid';
import { levelColor } from './level-colors';
import { getShinyRound, startShiny, submitShinyChoice } from './shiny-api';
import {
  clearShiny,
  loadShinyDone,
  loadShinySaved,
  saveShiny,
  saveShinyDone,
  shinyDailyStatus,
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
    'Plusieurs Pokémon, un seul est shiny (couleur chromatique).',
    'Clique sur celui qui est shiny.',
    'Aucun chrono, mais 5 manches : vise le meilleur score.',
  ],
  FIND_NON_SHINY: [
    'Plusieurs Pokémon, tous shiny sauf un.',
    'Clique sur celui qui n’est PAS shiny (couleur normale).',
    'Aucun chrono, mais 5 manches : vise le meilleur score.',
  ],
};

const OTHER_MODE: Record<ShinyMode, { mode: ShinyMode; route: string }> = {
  FIND_SHINY: { mode: 'FIND_NON_SHINY', route: '/non-shiny' },
  FIND_NON_SHINY: { mode: 'FIND_SHINY', route: '/shiny' },
};

const LEVELS: { level: ShinyLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: '3 cartes' },
  { level: 'MOYEN', label: 'Moyen', description: '4 cartes' },
  { level: 'DIFFICILE', label: 'Difficile', description: '6 cartes' },
];

const LEVEL_LABEL: Record<ShinyLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
};

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function ShinyPage({ mode }: ShinyPageProps) {
  const [level, setLevel] = useState<ShinyLevel | null>(null);

  if (!level) {
    return <ShinyLevelSelect mode={mode} onPick={setLevel} />;
  }
  return <ShinyGame key={`${mode}-${level}`} mode={mode} level={level} onBack={() => setLevel(null)} />;
}

function ShinyLevelSelect({ mode, onPick }: { mode: ShinyMode; onPick: (level: ShinyLevel) => void }) {
  const options = useMemo<LevelOption<ShinyLevel>[]>(
    () => LEVELS.map((l) => ({ ...l, status: shinyDailyStatus(mode, l.level) })),
    [mode],
  );
  return (
    <LevelSelectScreen
      title={MODE_TITLE[mode]}
      rules={MODE_RULES[mode]}
      options={options}
      onPick={onPick}
    />
  );
}

function ShinyGame({
  mode,
  level,
  onBack,
}: {
  mode: ShinyMode;
  level: ShinyLevel;
  onBack: () => void;
}) {
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
  const [alreadyDone, setAlreadyDone] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReveal(null);
    setChosenSlot(null);
    setEnded(false);
    setEndInfo(null);
    try {
      const round = await startShiny(mode, level);
      setState(round);
      saveShiny(mode, level, round.roundId, round.roundIndex);
    } catch (err) {
      if (isDailyCompletedError(err)) {
        setAlreadyDone(true);
        return;
      }
      clearShiny(mode, level);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, [mode, level]);

  const restoreOrStart = useCallback(async () => {
    const today = shinyTodayKey();
    const done = loadShinyDone(mode, level);
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadShinySaved(mode, level);
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getShinyRound(saved.roundId);
      if (round.status === 'FINISHED') {
        saveShinyDone(mode, level, round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
        saveShiny(mode, level, round.roundId, round.roundIndex);
      }
      setLoading(false);
    } catch {
      clearShiny(mode, level);
      await start();
    }
  }, [mode, level, start]);

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
        saveShinyDone(mode, level, res.state.correctCount, res.state.totalRounds);
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
      saveShiny(mode, level, next.roundId, next.roundIndex);
      setReveal(null);
      setChosenSlot(null);
    }
  };

  const renderTile = (slot: number, imageUrl: string) => {
    const info = revealMap.get(slot);
    const isAnswer = info?.isAnswer ?? false;
    const isWrongPick = reveal !== null && chosenSlot === slot && !isAnswer;
    const result: TileResult = isAnswer
      ? 'correct'
      : isWrongPick
        ? 'wrong'
        : reveal !== null
          ? 'dimmed'
          : 'none';

    return (
      <PokemonTile
        key={imageUrl}
        src={`${API_ORIGIN}${imageUrl}`}
        disabled={reveal !== null || busy}
        onClick={() => void onChoose(slot)}
        result={result}
        pixelated
        mark={info?.isShiny ? <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> : undefined}
        caption={
          info ? (
            <span className="text-[11px] font-extrabold leading-tight text-foreground">{info.name}</span>
          ) : undefined
        }
      />
    );
  };

  const other = OTHER_MODE[mode];

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
            <Card className="flex w-full max-w-xl flex-col items-center gap-4 p-4 sm:gap-5 sm:p-6">
              <div className="flex w-full flex-wrap items-start justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="Changer de niveau"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="font-display text-sm leading-relaxed text-foreground">
                    {MODE_TITLE[mode]}
                  </h1>
                  <Badge
                    style={
                      {
                        borderColor: levelColor(state.level),
                        backgroundColor: levelColor(state.level),
                        color: '#2B2A24',
                      } as CSSProperties
                    }
                  >
                    {LEVEL_LABEL[state.level]}
                  </Badge>
                </div>
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

              <ArenaInstruction icon={<Sparkles className="h-3.5 w-3.5 text-foreground" />}>
                {state.prompt}
              </ArenaInstruction>

              <TileGrid>{state.tiles.map((tile) => renderTile(tile.slot, tile.imageUrl))}</TileGrid>

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
