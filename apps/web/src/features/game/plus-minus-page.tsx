import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlusMinusChoiceResponse, PlusMinusRoundState } from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { getPlusMinusRound, startPlusMinus, submitPlusMinusChoice } from './plus-minus-api';
import {
  clearPlusMinus,
  loadPlusMinusDone,
  loadPlusMinusSaved,
  plusMinusTodayKey,
  savePlusMinus,
  savePlusMinusDone,
} from './plus-minus-storage';

interface EndInfo {
  correctCount: number;
  totalRounds: number;
}

export function PlusMinusPage() {
  const navigate = useNavigate();
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
      const round = await startPlusMinus();
      setState(round);
      savePlusMinus(round.roundId);
    } catch (err) {
      clearPlusMinus();
      setError(getApiErrorMessage(err, 'Impossible de démarrer le défi du jour'));
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreOrStart = useCallback(async () => {
    const today = plusMinusTodayKey();
    const done = loadPlusMinusDone();
    if (done && done.date === today) {
      setEndInfo({ correctCount: done.correctCount, totalRounds: done.totalRounds });
      setEnded(true);
      setLoading(false);
      return;
    }
    const saved = loadPlusMinusSaved();
    if (!saved || saved.date !== today) {
      await start();
      return;
    }
    setLoading(true);
    try {
      const round = await getPlusMinusRound(saved.roundId);
      if (round.status === 'FINISHED') {
        savePlusMinusDone(round.correctCount, round.totalRounds);
        setEndInfo({ correctCount: round.correctCount, totalRounds: round.totalRounds });
        setEnded(true);
      } else {
        setState(round);
      }
      setLoading(false);
    } catch {
      clearPlusMinus();
      await start();
    }
  }, [start]);

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
        savePlusMinusDone(res.state.correctCount, res.state.totalRounds);
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

    return (
      <button
        type="button"
        disabled={reveal !== null || busy}
        onClick={() => void onChoose(side)}
        className={cn(
          'flex flex-1 flex-col items-center gap-2 rounded-card border-4 bg-white p-4 transition-colors duration-150',
          reveal === null && 'cursor-pointer hover:border-primary',
          isCorrect
            ? 'border-go bg-go/10'
            : isWrongPick
              ? 'border-danger bg-danger/10'
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
          <span className="font-display text-xs text-primary">{value.displayValue}</span>
        ) : (
          <span className="font-display text-xs text-muted">?</span>
        )}
      </button>
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
                  <h1 className="text-lg font-extrabold text-foreground">Plus ou Moins</h1>
                  <p className="text-sm font-semibold text-muted">
                    Défi du jour, manche {state.roundIndex} sur {state.totalRounds}
                  </p>
                </div>
                <Badge className="border-primary bg-primary text-primary-foreground">
                  {state.correctCount} bonne{state.correctCount > 1 ? 's' : ''}
                </Badge>
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
                  <p
                    className={cn(
                      'text-sm font-bold',
                      reveal.correct ? 'text-success' : 'text-danger',
                    )}
                  >
                    {reveal.correct ? 'Bonne réponse !' : 'Raté !'}
                  </p>
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
