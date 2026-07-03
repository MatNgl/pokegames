import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import {
  GUESS_WHO_EVENTS,
  type GuessWhoOverDTO,
  type GuessWhoStateDTO,
} from '@pokegames/shared-types';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
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
  const reduce = useReducedMotion();
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
  const [turnTotal, setTurnTotal] = useState(30);
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

  // Duree totale du tour, capturee a l'arrivee d'une nouvelle echeance, pour l'anneau du minuteur.
  useEffect(() => {
    if (state?.turnDeadline) {
      setTurnTotal(Math.max(1, Math.ceil((state.turnDeadline - Date.now()) / 1000)));
    }
  }, [state?.turnDeadline]);

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
        <Card className="mt-10 flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-sm text-foreground">Qui est-ce ?</h1>
          <p className="text-sm font-semibold text-muted">Connecte-toi pour jouer en 1 contre 1.</p>
          <Button className="w-full" onClick={() => navigate('/connexion', { state: { from: '/qui-est-ce' } })}>
            Se connecter
          </Button>
          <Button className="w-full" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
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
          <Button className="w-full" onClick={() => navigate('/')}>
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
              <Button className="w-full" onClick={() => navigate('/')}>
                Retour à l'accueil
              </Button>
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

  const remaining = state.grid.length - eliminated.size;
  const yourTurnNow = myAsking || myEliminating;

  return (
    <Shell>
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        {/* Plateau encadre */}
        <Card className="flex-1 border-4 border-border-strong p-3 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xs leading-relaxed text-foreground">Qui est-ce ?</h1>
              <p className="mt-1 text-sm font-semibold text-muted">vs {state.opponentName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  yourTurnNow
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong bg-surface-2 text-muted',
                )}
              >
                {yourTurnNow ? 'À toi de jouer' : 'Tour adverse'}
              </Badge>
              {secondsLeft !== null && <TimerRing seconds={secondsLeft} total={turnTotal} />}
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-success">
              {remaining} Pokémon encore possibles
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <Pokeball className="h-3.5 w-3.5" />
              carte rabattue = éliminée
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {state.grid.map((card) => (
              <BoardCard
                key={card.pokemonId}
                card={card}
                isSecret={card.pokemonId === state.yourSecretPokemonId}
                eliminated={eliminated.has(card.pokemonId)}
                guessMode={guessMode}
                reduce={Boolean(reduce)}
                onClick={() => toggleCard(card.pokemonId)}
              />
            ))}
          </div>

          {guessMode && (
            <p className="mt-2 text-center text-sm font-bold text-danger">
              Clique sur le Pokémon que tu penses être celui de l'adversaire.
            </p>
          )}
        </Card>

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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Ton Pokémon secret
              </p>
              <p className="truncate font-display text-xs text-primary">{mySecret?.name}</p>
            </div>
          </Card>

          <Card className="p-3">
            <p className="text-center text-sm font-bold text-foreground">
              {myAsking && 'À toi : pose une question'}
              {myAnswering && "Réponds à la question"}
              {myEliminating && 'Élimine des Pokémon'}
              {state.yourTurn && state.phase === 'ANSWERING' && "En attente de l'adversaire..."}
              {!state.yourTurn && state.phase === 'ASKING' && "L'adversaire réfléchit..."}
              {!state.yourTurn && state.phase === 'ELIMINATING' && "L'adversaire élimine..."}
            </p>
          </Card>

          <Card className="flex max-h-52 flex-col gap-1.5 overflow-auto p-3">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
              Journal du duel
            </p>
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

function Pokeball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#fff" stroke="#28338c" strokeWidth="2" />
      <path d="M2.4 15 A13.6 13.6 0 0 1 29.6 15 Z" fill="#EE1515" />
      <rect x="2.2" y="14" width="27.6" height="4" fill="#28338c" />
      <circle cx="16" cy="16" r="4.2" fill="#fff" stroke="#28338c" strokeWidth="2" />
    </svg>
  );
}

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, seconds) / Math.max(1, total));
  const low = seconds <= 5;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-label={`${seconds} secondes restantes`}>
      <circle cx="23" cy="23" r={r} fill="#fff" stroke="#ece4ba" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={low ? '#EE1515' : '#3B4CCA'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 23 23)"
        style={{ transition: 'stroke-dashoffset 0.5s linear' }}
      />
      <text x="23" y="27" textAnchor="middle" fontSize="14" fontWeight={600} fill="#2b2a24">
        {seconds}
      </text>
    </svg>
  );
}

function BoardCard({
  card,
  isSecret,
  eliminated,
  guessMode,
  reduce,
  onClick,
}: {
  card: GuessWhoStateDTO['grid'][number];
  isSecret: boolean;
  eliminated: boolean;
  guessMode: boolean;
  reduce: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={card.name}
      aria-pressed={eliminated}
      className={cn('relative aspect-square w-full', guessMode && 'cursor-pointer')}
      style={{ perspective: 600 }}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: eliminated ? 'rotateY(180deg)' : 'none',
          transition: reduce ? 'none' : 'transform 0.45s',
        }}
      >
        {/* Face visible : le Pokemon */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white p-1',
            guessMode && !eliminated && 'ring-2 ring-danger/40 hover:ring-4 hover:ring-danger',
          )}
          style={{
            backfaceVisibility: 'hidden',
            border: `3px solid ${isSecret ? '#3B4CCA' : '#3f5d1d'}`,
          }}
        >
          {isSecret && (
            <span
              className="absolute -top-2 rounded-md px-1.5 py-0.5 font-display text-[7px] tracking-wide text-white"
              style={{ background: '#3B4CCA' }}
            >
              SECRET
            </span>
          )}
          <img
            src={`${API_ORIGIN}/api/pokemon/${card.pokemonId}/sprite`}
            alt={card.name}
            className="h-9 w-9 object-contain sm:h-11 sm:w-11"
            draggable={false}
          />
          <span className="w-full truncate text-center text-[9px] font-bold text-foreground">
            {card.name}
          </span>
        </div>
        {/* Dos : carte rabattue (eliminee) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: '#3B4CCA',
            border: '3px solid #28338c',
          }}
        >
          <Pokeball className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
      </div>
    </button>
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
