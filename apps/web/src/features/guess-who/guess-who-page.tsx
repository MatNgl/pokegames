import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  GUESS_WHO_EVENTS,
  type GuessWhoOverDTO,
  type GuessWhoStateDTO,
} from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_ORIGIN } from '@/lib/env';
import { getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-context';

interface ChatEntry {
  mine: boolean;
  text: string;
  answer?: boolean;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 py-6">
          {children}
        </main>
      </div>
    </AppBackground>
  );
}

export function GuessWhoPage() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [state, setState] = useState<GuessWhoStateDTO | null>(null);
  const [over, setOver] = useState<GuessWhoOverDTO | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [guessMode, setGuessMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [showIntro, setShowIntro] = useState(false);
  const [introCount, setIntroCount] = useState(4);
  const inGameRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${API_ORIGIN}/guess-who`, {
      auth: { token: getAccessToken() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(GUESS_WHO_EVENTS.waiting, () => {
      setWaiting(true);
      setRoomCode(null);
    });
    socket.on(GUESS_WHO_EVENTS.roomCreated, (p: { code: string }) => setRoomCode(p.code));
    socket.on(GUESS_WHO_EVENTS.state, (s: GuessWhoStateDTO) => {
      setWaiting(false);
      setRoomCode(null);
      setOver(null);
      setState(s);
      if (!inGameRef.current) {
        inGameRef.current = true;
        setChat([]);
        setEliminated(new Set());
        setShowIntro(true);
        setIntroCount(4);
      }
    });
    socket.on(GUESS_WHO_EVENTS.question, (p: { text: string }) => {
      setChat((c) => [...c, { mine: false, text: p.text }]);
    });
    socket.on(GUESS_WHO_EVENTS.answered, (p: { value: boolean | null }) => {
      if (p.value === null) {
        setChat((c) => [...c, { mine: false, text: 'Temps écoulé, pas de réponse' }]);
        return;
      }
      const value: boolean = p.value;
      setChat((c) => [...c, { mine: false, text: value ? 'Oui' : 'Non', answer: value }]);
    });
    socket.on(GUESS_WHO_EVENTS.over, (o: GuessWhoOverDTO) => setOver(o));
    socket.on(GUESS_WHO_EVENTS.errorMsg, (p: { message: string }) => setError(p.message));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Ecran "Adversaire trouve" : petit decompte avant le debut de la partie.
  useEffect(() => {
    if (!showIntro) return;
    if (introCount <= 0) {
      setShowIntro(false);
      return;
    }
    const t = setTimeout(() => setIntroCount((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [showIntro, introCount]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const ask = () => {
    const text = draft.trim();
    if (!text) return;
    emit(GUESS_WHO_EVENTS.ask, { text });
    setChat((c) => [...c, { mine: true, text }]);
    setDraft('');
  };

  const answer = (value: boolean) => {
    emit(GUESS_WHO_EVENTS.answer, { value });
    setChat((c) => [...c, { mine: true, text: value ? 'Oui' : 'Non', answer: value }]);
  };

  const toggleCard = (pokemonId: number) => {
    // Reponse finale : seulement a son tour, avant d'avoir pose la question.
    if (guessMode && state?.yourTurn && state.phase === 'ASKING') {
      emit(GUESS_WHO_EVENTS.finalGuess, { pokemonId });
      setGuessMode(false);
      return;
    }
    setEliminated((prev) => {
      const next = new Set(prev);
      if (next.has(pokemonId)) next.delete(pokemonId);
      else next.add(pokemonId);
      return next;
    });
  };

  const leave = () => {
    emit(GUESS_WHO_EVENTS.cancel);
    inGameRef.current = false;
    setShowIntro(false);
    setWaiting(false);
    setRoomCode(null);
    setState(null);
    setOver(null);
    setChat([]);
    setEliminated(new Set());
    setGuessMode(false);
  };

  if (initializing) return <Shell>{null}</Shell>;

  if (!user) {
    return (
      <Shell>
        <Card className="mt-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-sm text-foreground">Qui est-ce ?</h1>
          <p className="text-sm font-semibold text-muted">Connecte-toi pour jouer en 1 contre 1.</p>
          <Button onClick={() => navigate('/connexion')}>Se connecter</Button>
        </Card>
      </Shell>
    );
  }

  // Ecran de fin.
  if (over && state) {
    return (
      <Shell>
        <Card className="mt-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <span
            className={cn(
              'font-display text-sm uppercase tracking-widest',
              over.youWon ? 'text-success' : 'text-danger',
            )}
          >
            {over.youWon ? 'Gagné !' : 'Perdu'}
          </span>
          <p className="text-sm font-semibold text-muted">
            {over.reason === 'FORFEIT'
              ? 'Ton adversaire a quitté la partie.'
              : `${over.winnerName} remporte la partie.`}
          </p>
          <div className="flex gap-6">
            <SecretReveal label="Le tien" grid={state.grid} id={over.yourSecretPokemonId} />
            <SecretReveal label="L'adversaire" grid={state.grid} id={over.opponentSecretPokemonId} />
          </div>
          <Button className="w-full" onClick={leave}>
            Rejouer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </Card>
      </Shell>
    );
  }

  // Lobby.
  if (!state) {
    return (
      <Shell>
        <Card className="mt-10 flex w-full max-w-md flex-col gap-4 p-6">
          <h1 className="font-display text-sm leading-relaxed text-foreground">Qui est-ce ?</h1>
          <p className="text-sm font-semibold text-muted">
            Duel 1 contre 1 : devine le Pokémon secret de l'adversaire en posant des questions.
          </p>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          {waiting ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm font-bold text-foreground">En attente d'un adversaire...</p>
              {roomCode && (
                <p className="text-sm text-muted">
                  Code du salon : <span className="font-display text-primary">{roomCode}</span>
                </p>
              )}
              <Button variant="secondary" size="sm" onClick={leave}>
                Annuler
              </Button>
            </div>
          ) : roomCode ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm font-semibold text-muted">Partage ce code avec ton adversaire :</p>
              <p className="font-display text-2xl text-primary">{roomCode}</p>
              <Button variant="secondary" size="sm" onClick={leave}>
                Annuler
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                disabled={!connected}
                onClick={() => {
                  setError(null);
                  emit(GUESS_WHO_EVENTS.joinQueue);
                }}
              >
                Trouver un adversaire
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={!connected}
                onClick={() => {
                  setError(null);
                  emit(GUESS_WHO_EVENTS.createRoom);
                }}
              >
                Créer un salon
              </Button>
              <div className="flex gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Code du salon"
                  maxLength={4}
                />
                <Button
                  disabled={!connected || joinCode.length < 4}
                  onClick={() => {
                    setError(null);
                    emit(GUESS_WHO_EVENTS.joinRoom, { code: joinCode });
                  }}
                >
                  Rejoindre
                </Button>
              </div>
              {!connected && <p className="text-center text-xs text-muted">Connexion au serveur...</p>}
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  // Ecran "Adversaire trouve" avec decompte + revelation du Pokemon secret.
  if (showIntro) {
    const secret = state.grid.find((c) => c.pokemonId === state.yourSecretPokemonId);
    return (
      <Shell>
        <Card className="mt-10 flex w-full max-w-md flex-col items-center gap-3 p-8 text-center">
          <span className="font-display text-sm uppercase tracking-widest text-success">
            Adversaire trouvé
          </span>
          <p className="text-sm font-semibold text-muted">vs {state.opponentName}</p>
          <p className="mt-2 text-sm font-bold text-foreground">Ton Pokémon secret :</p>
          <img
            src={`${API_ORIGIN}/api/pokemon/${state.yourSecretPokemonId}/sprite`}
            alt={secret?.name ?? ''}
            className="h-28 w-28 object-contain"
            draggable={false}
          />
          <p className="font-display text-lg text-primary">{secret?.name}</p>
          <p className="text-sm font-semibold text-muted">
            La partie commence dans {introCount}s...
          </p>
        </Card>
      </Shell>
    );
  }

  // Partie en cours.
  const mySecret = state.grid.find((c) => c.pokemonId === state.yourSecretPokemonId);
  const myAnswering = !state.yourTurn && state.phase === 'ANSWERING';
  const myAsking = state.yourTurn && state.phase === 'ASKING';
  const myEliminating = state.yourTurn && state.phase === 'ELIMINATING';
  const secondsLeft = state.turnDeadline
    ? Math.max(0, Math.ceil((state.turnDeadline - nowTick) / 1000))
    : null;

  return (
    <Shell>
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        {/* Plateau */}
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h1 className="font-display text-xs text-foreground">Qui est-ce ?</h1>
            <span className="text-xs font-semibold text-muted">vs {state.opponentName}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {state.grid.map((card) => {
              const isSecret = card.pokemonId === state.yourSecretPokemonId;
              const isOut = eliminated.has(card.pokemonId);
              return (
                <button
                  key={card.pokemonId}
                  type="button"
                  onClick={() => toggleCard(card.pokemonId)}
                  className={cn(
                    'relative flex flex-col items-center rounded-md border-2 bg-white p-1 transition-colors',
                    isSecret ? 'border-primary' : 'border-border-strong',
                    guessMode && 'cursor-pointer hover:border-danger',
                    isOut && 'opacity-40 grayscale',
                  )}
                  title={card.name}
                >
                  <img
                    src={`${API_ORIGIN}/api/pokemon/${card.pokemonId}/sprite`}
                    alt={card.name}
                    className="h-10 w-10 object-contain sm:h-12 sm:w-12"
                    draggable={false}
                  />
                  <span className="w-full truncate text-center text-[9px] font-bold text-foreground">
                    {card.name}
                  </span>
                </button>
              );
            })}
          </div>
          {guessMode && (
            <p className="mt-2 text-center text-sm font-bold text-danger">
              Clique sur le Pokémon que tu penses être celui de l'adversaire.
            </p>
          )}
        </div>

        {/* Panneau lateral : secret + etat + chat + actions */}
        <div className="flex w-full flex-col gap-3 lg:w-72">
          <Card className="flex items-center gap-3 p-3">
            <img
              src={`${API_ORIGIN}/api/pokemon/${state.yourSecretPokemonId}/sprite`}
              alt={mySecret?.name ?? ''}
              className="h-12 w-12 shrink-0 object-contain"
              draggable={false}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase text-muted">Ton Pokémon</p>
              <p className="truncate font-display text-xs text-primary">{mySecret?.name}</p>
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-3">
            <p className="text-center text-sm font-bold text-foreground">
              {myAsking && 'À toi : pose une question'}
              {myAnswering && "Réponds à la question"}
              {myEliminating && 'Élimine des Pokémon'}
              {state.yourTurn && state.phase === 'ANSWERING' && "En attente de l'adversaire..."}
              {!state.yourTurn && state.phase === 'ASKING' && "L'adversaire réfléchit..."}
              {!state.yourTurn && state.phase === 'ELIMINATING' && "L'adversaire élimine..."}
            </p>
            {secondsLeft !== null && (
              <p className="text-center font-display text-lg text-primary">{secondsLeft}s</p>
            )}
          </Card>

          <Card className="flex max-h-52 flex-col gap-1.5 overflow-auto p-3">
            {chat.length === 0 ? (
              <p className="text-center text-xs text-muted">Les questions s'affichent ici.</p>
            ) : (
              chat.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-control px-2 py-1 text-xs font-semibold',
                    m.mine ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-surface-2 text-foreground',
                    m.answer !== undefined &&
                      (m.answer ? 'bg-go text-go-foreground' : 'bg-danger text-white'),
                  )}
                >
                  {m.text}
                </div>
              ))
            )}
          </Card>

          {myAnswering && (
            <div className="flex gap-2">
              <Button className="flex-1" variant="go" onClick={() => answer(true)}>
                Oui
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => answer(false)}>
                Non
              </Button>
            </div>
          )}

          {myAsking && (
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder="Ta question (Oui/Non)"
              />
              <Button onClick={ask} disabled={!draft.trim()}>
                Envoyer
              </Button>
            </div>
          )}

          {myAsking && (
            <Button
              variant={guessMode ? 'secondary' : 'go'}
              onClick={() => setGuessMode((v) => !v)}
            >
              {guessMode ? 'Annuler la réponse finale' : 'Soumettre une réponse finale'}
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={leave}>
            Abandonner
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function SecretReveal({ label, grid, id }: { label: string; grid: GuessWhoStateDTO['grid']; id: number }) {
  const card = grid.find((c) => c.pokemonId === id);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <img
        src={`${API_ORIGIN}/api/pokemon/${id}/sprite`}
        alt={card?.name ?? ''}
        className="h-16 w-16 object-contain"
        draggable={false}
      />
      <span className="text-xs font-bold text-foreground">{card?.name}</span>
    </div>
  );
}
