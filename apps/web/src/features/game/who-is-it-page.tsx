import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  WhoIsItGuessResponse,
  WhoIsItHintType,
  WhoIsItRoundState,
} from '@pokegames/shared-types';
import { AppHeader } from '@/components/layout/app-header';
import { DotBackground } from '@/components/backgrounds/dot-background';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { getApiErrorMessage } from '@/lib/errors';
import { getPokemonNames, requestHint, startRound, submitGuess } from './game-api';
import { GuessAutocomplete } from './components/guess-autocomplete';
import { HintLadder } from './components/hint-ladder';
import { RoundResult } from './components/round-result';
import { ScorePill } from './components/score-pill';
import { SilhouetteStage } from './components/silhouette-stage';

export function WhoIsItPage() {
  const [round, setRound] = useState<WhoIsItRoundState | null>(null);
  const [result, setResult] = useState<WhoIsItGuessResponse | null>(null);
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [spriteVersion, setSpriteVersion] = useState(0);

  const { data: names = [] } = useQuery({
    queryKey: ['pokemon-names'],
    queryFn: getPokemonNames,
    staleTime: Infinity,
  });

  const newRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedback(null);
    setGuess('');
    try {
      const state = await startRound({ mode: 'CLASSIC' });
      setRound(state);
      setSpriteVersion((v) => v + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de démarrer la manche'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void newRound();
  }, [newRound]);

  const solved = result?.status === 'SOLVED';
  const spriteUrl = round ? `${API_ORIGIN}${round.spriteProxyUrl}?v=${spriteVersion}` : '';

  const onGuess = async (event: FormEvent) => {
    event.preventDefault();
    if (!round || !guess.trim() || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await submitGuess(round.roundId, guess.trim());
      if (res.isCorrect) {
        setResult(res);
        setSpriteVersion((v) => v + 1);
      } else {
        setRound({
          ...round,
          currentScore: res.currentScore,
          mistakesCount: res.mistakesCount,
          hints: res.hints,
        });
        setFeedback(res.message ?? "Ce n'est pas le bon Pokémon.");
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

  return (
    <DotBackground>
      <div className="flex h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center overflow-auto px-4 py-6">
        {loading ? (
          <Spinner className="h-7 w-7 text-primary" />
        ) : !round ? (
          <Card className="max-w-md p-6 text-center">
            <p className="text-sm text-danger">{error ?? 'Une erreur est survenue.'}</p>
            <Button className="mt-4" onClick={() => void newRound()}>
              Réessayer
            </Button>
          </Card>
        ) : (
          <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-foreground">Quel est ce Pokémon ?</h1>
                  <p className="text-sm text-muted">
                    Manche {round.roundIndex} sur {round.totalRounds}
                  </p>
                </div>
                <ScorePill score={round.currentScore} mistakes={round.mistakesCount} />
              </div>

              {solved && result ? (
                <RoundResult result={result} spriteUrl={spriteUrl} onNext={() => void newRound()} />
              ) : (
                <>
                  <SilhouetteStage src={spriteUrl} revealed={false} />
                  <form onSubmit={onGuess} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <GuessAutocomplete
                        value={guess}
                        names={names}
                        disabled={busy}
                        onChange={setGuess}
                      />
                      <Button type="submit" disabled={busy || !guess.trim()}>
                        {busy ? <Spinner className="h-4 w-4" /> : 'Valider'}
                      </Button>
                    </div>
                    {feedback && <p className="text-sm text-danger">{feedback}</p>}
                    {error && <p className="text-sm text-danger">{error}</p>}
                  </form>
                </>
              )}
            </div>

            {!solved && (
              <Card className="p-5">
                <HintLadder
                  hints={round.hints}
                  mistakes={round.mistakesCount}
                  busy={busy}
                  onReveal={(type) => void onReveal(type)}
                />
              </Card>
            )}
          </div>
        )}
        </main>
      </div>
    </DotBackground>
  );
}
