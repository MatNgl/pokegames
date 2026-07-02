import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type {
  TrueShinyChoiceResponse,
  TrueShinyLevel,
  TrueShinyRoundState,
  TrueShinyTileReveal,
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
import { levelColor, LEVEL_BADGE_TEXT, LEVEL_BADGE_TEXT_SHADOW } from './level-colors';
import { getTrueShinyRound, startTrueShiny, submitTrueShinyChoice } from './true-shiny-api';
import {
  clearTrueShiny,
  loadTrueShinyDone,
  loadTrueShinySaved,
  saveTrueShiny,
  saveTrueShinyDone,
  trueShinyDailyStatus,
  trueShinyTodayKey,
} from './true-shiny-storage';

const TRUE_SHINY_RULES = [
  'Toutes les vignettes montrent le même Pokémon shiny.',
  'Une seule est le sprite officiel intact, les autres sont altérées.',
  'Clique sur la version authentique.',
  '5 manches : vise le meilleur score.',
];

const LEVELS: { level: TrueShinyLevel; label: string; description: string }[] = [
  { level: 'FACILE', label: 'Facile', description: '3 cartes, altérations marquées' },
  { level: 'MOYEN', label: 'Moyen', description: '5 cartes, altérations modérées' },
  { level: 'DIFFICILE', label: 'Difficile', description: '6 cartes, altérations subtiles' },
];

const LEVEL_LABEL: Record<TrueShinyLevel, string> = {
  FACILE: 'Facile',
  MOYEN: 'Moyen',
  DIFFICILE: 'Difficile',
};

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function TrueShinyPage() {
  const [level, setLevel] = useState<TrueShinyLevel | null>(null);

  if (!level) {
    return <LevelSelect onPick={setLevel} />;
  }
  return <TrueShinyGame key={level} level={level} onBack={() => setLevel(null)} />;
}

function LevelSelect({ onPick }: { onPick: (level: TrueShinyLevel) => void }) {
  const options = useMemo<LevelOption<TrueShinyLevel>[]>(
    () => LEVELS.map((l) => ({ ...l, status: trueShinyDailyStatus(l.level) })),
    [],
  );
  return (
    <LevelSelectScreen
      title="Le Bon Shiny"
      rules={TRUE_SHINY_RULES}
      options={options}
      onPick={onPick}
    />
  );
}

function TrueShinyGame({ level, onBack }: { level: TrueShinyLevel; onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<TrueShinyRoundState | null>(null);
  const [reveal, setReveal] = useState<TrueShinyChoiceResponse | null>(null);
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
      const round = await startTrueShiny(level);
      setState(round);
      saveTrueShiny(level, round.roundId, round.roundIndex);
    } catch (err) {
      if (isDailyCompletedError(err)) {
        setAlreadyDone(true);
        return;
      }
      clearTrueShiny(level);
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, [level]);

  const restoreOrStart = useCallback(async () => {
    const today = trueShinyTodayKey();
    const done = loadTrueShinyDone(level);
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadTrueShinySaved(level);
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getTrueShinyRound(saved.roundId);
      if (round.status === 'FINISHED') {
        saveTrueShinyDone(level, round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
        saveTrueShiny(level, round.roundId, round.roundIndex);
      }
      setLoading(false);
    } catch {
      clearTrueShiny(level);
      await start();
    }
  }, [level, start]);

  useEffect(() => {
    void restoreOrStart();
  }, [restoreOrStart]);

  const revealMap = useMemo(() => {
    const map = new Map<number, TrueShinyTileReveal>();
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
      const res = await submitTrueShinyChoice(state.roundId, slot);
      setReveal(res);
      if (res.state.status === 'FINISHED') {
        saveTrueShinyDone(level, res.state.correctCount, res.state.totalRounds);
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
      saveTrueShiny(level, next.roundId, next.roundIndex);
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
        ariaLabel={`Choisir la case ${slot + 1}`}
        disabled={reveal !== null || busy}
        onClick={() => void onChoose(slot)}
        result={result}
        pixelated
      />
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
                  <h1 className="font-display text-sm leading-relaxed text-foreground">Le Bon Shiny</h1>
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
                  <HelpPopover ariaLabel="Règles du Bon Shiny" rules={TRUE_SHINY_RULES} />
                </div>
              </div>

              <ArenaInstruction>
                Trouve le shiny intact
              </ArenaInstruction>

              <TileGrid>{state.tiles.map((tile) => renderTile(tile.slot, tile.imageUrl))}</TileGrid>

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
