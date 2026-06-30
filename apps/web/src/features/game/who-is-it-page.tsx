import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  WhoIsItGuessResponse,
  WhoIsItHintType,
  WhoIsItRoundState,
} from '@pokegames/shared-types';
import { AppHeader } from '@/components/layout/app-header';
import { AppBackground } from '@/components/backgrounds/app-background';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { API_ORIGIN } from '@/lib/env';
import { getApiErrorMessage } from '@/lib/errors';
import {
  getPokemonNames,
  getRoundState,
  requestHint,
  startRound,
  submitGuess,
} from './game-api';
import { GuessAutocomplete } from './components/guess-autocomplete';
import { HintIcons } from './components/hint-icons';
import { RoundResult } from './components/round-result';
import { SilhouetteStage } from './components/silhouette-stage';

const TOTAL_ROUNDS = 5;

// Persistance locale de la partie : un refresh restaure le meme Pokemon, le nombre d'essais cumule,
// l'etape et les mauvaises reponses deja tentees (l'etat de la manche vit en Redis cote serveur).
const STORAGE_KEY = 'pokegames:who-is-it';

interface SavedGame {
  roundId: string;
  tried: string[];
  totalAttempts: number;
}

function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;
    if (parsed && typeof parsed.roundId === 'string') {
      return {
        roundId: parsed.roundId,
        tried: Array.isArray(parsed.tried) ? parsed.tried : [],
        totalAttempts: typeof parsed.totalAttempts === 'number' ? parsed.totalAttempts : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function persistSavedGame(game: SavedGame): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // Stockage indisponible : on continue sans persistance.
  }
}

function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien a faire si le stockage est indisponible.
  }
}

export function WhoIsItPage() {
  const navigate = useNavigate();
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

  const { data: names = [] } = useQuery({
    queryKey: ['pokemon-names'],
    queryFn: getPokemonNames,
    staleTime: Infinity,
  });

  const startManche = useCallback(async (roundIndex: number, carriedAttempts: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedback(null);
    setGuess('');
    setTried([]);
    setGameOver(false);
    try {
      const state = await startRound({ mode: 'CLASSIC', roundsCount: TOTAL_ROUNDS, roundIndex });
      setRound(state);
      setTotalAttempts(carriedAttempts);
      persistSavedGame({ roundId: state.roundId, tried: [], totalAttempts: carriedAttempts });
      setSpriteVersion((v) => v + 1);
    } catch (err) {
      clearSavedGame();
      setError(getApiErrorMessage(err, 'Impossible de démarrer la manche'));
    } finally {
      setLoading(false);
    }
  }, []);

  const newGame = useCallback(() => {
    void startManche(1, 0);
  }, [startManche]);

  const restoreOrStart = useCallback(async () => {
    const saved = loadSavedGame();
    if (!saved) {
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
          setRound(state);
          setTotalAttempts(carried);
          setGameOver(true);
          setResult(null);
          clearSavedGame();
          setLoading(false);
        } else {
          void startManche(state.roundIndex + 1, carried);
        }
      }
    } catch {
      clearSavedGame();
      void startManche(1, 0);
    }
  }, [startManche]);

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
      } else {
        const nextTried = [...tried, attempt];
        setTried(nextTried);
        setRound({
          ...round,
          currentScore: res.currentScore,
          mistakesCount: res.mistakesCount,
          hints: res.hints,
        });
        persistSavedGame({ roundId: round.roundId, tried: nextTried, totalAttempts });
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

  const advance = () => {
    if (!round || !result) return;
    const carried = totalAttempts + result.mistakesCount + 1;
    if (round.roundIndex >= round.totalRounds) {
      setTotalAttempts(carried);
      setGameOver(true);
      setResult(null);
      clearSavedGame();
    } else {
      void startManche(round.roundIndex + 1, carried);
    }
  };

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          {loading ? (
            <Spinner className="h-7 w-7 text-primary" />
          ) : gameOver && round ? (
            <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
              <span className="font-display text-[10px] uppercase tracking-widest text-success">
                Partie terminée
              </span>
              <p className="text-sm font-semibold text-muted">
                Tu as deviné les {round.totalRounds} Pokémon.
              </p>
              <p className="font-display text-2xl text-primary">{totalAttempts}</p>
              <p className="text-sm font-bold text-foreground">
                essai{totalAttempts > 1 ? 's' : ''} au total
              </p>
              <div className="flex w-full flex-col gap-2">
                <Button className="w-full" onClick={() => navigate('/')}>
                  Retour à l'accueil
                </Button>
                <Button variant="secondary" className="w-full" onClick={newGame}>
                  Rejouer
                </Button>
              </div>
            </Card>
          ) : !round ? (
            <Card className="max-w-md p-6 text-center">
              <p className="text-sm font-semibold text-danger">{error ?? 'Une erreur est survenue.'}</p>
              <Button className="mt-4" onClick={newGame}>
                Réessayer
              </Button>
            </Card>
          ) : (
            <Card className="flex w-full max-w-xl flex-col gap-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-extrabold text-foreground">Quel est ce Pokémon ?</h1>
                  <p className="text-sm font-semibold text-muted">
                    Manche {round.roundIndex} sur {round.totalRounds}
                  </p>
                </div>
                <Badge className="border-primary bg-primary text-primary-foreground">
                  {liveAttempts} essai{liveAttempts > 1 ? 's' : ''}
                </Badge>
              </div>

              {solved && result ? (
                <RoundResult
                  result={result}
                  spriteUrl={spriteUrl}
                  onNext={advance}
                  nextLabel={isLastRound ? 'Voir le résultat' : 'Manche suivante'}
                />
              ) : (
                <>
                  <div className="flex items-center justify-center gap-4">
                    <SilhouetteStage src={spriteUrl} revealed={false} />
                    <HintIcons
                      hints={round.hints}
                      mistakes={round.mistakesCount}
                      busy={busy}
                      onReveal={(type) => void onReveal(type)}
                    />
                  </div>

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
                    {feedback && <p className="text-center text-sm font-semibold text-danger">{feedback}</p>}
                    {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}
                  </form>
                </>
              )}
            </Card>
          )}
        </main>
      </div>
    </AppBackground>
  );
}
