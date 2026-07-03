import { Test, TestingModule } from '@nestjs/testing';
import { GUESS_WHO_EVENTS, type GuessWhoStateDTO } from '@pokegames/shared-types';
import { GuessWhoService } from './guess-who.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

const cards = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, nameFr: `P${i + 1}` }));

describe('GuessWhoService', () => {
  let service: GuessWhoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuessWhoService,
        { provide: PrismaService, useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(cards) } } },
        { provide: GameConfigService, useValue: gameConfigMock() },
      ],
    }).compile();
    service = module.get<GuessWhoService>(GuessWhoService);
  });

  const u1 = { userId: 'u1', username: 'Alice', socketId: 's1' };
  const u2 = { userId: 'u2', username: 'Bob', socketId: 's2' };

  async function startMatch(): Promise<GuessWhoStateDTO> {
    await service.joinQueue(u1);
    const start = await service.joinQueue(u2);
    return start[0]?.payload as GuessWhoStateDTO;
  }

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('file d’attente : le 1er attend, le 2e démarre la partie (grille de 25, secret perso)', async () => {
    const waiting = await service.joinQueue(u1);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.event).toBe(GUESS_WHO_EVENTS.waiting);

    const start = await service.joinQueue(u2);
    expect(start).toHaveLength(2);
    expect(start.every((e) => e.event === GUESS_WHO_EVENTS.state)).toBe(true);
    const state = start[0]?.payload as GuessWhoStateDTO;
    expect(state.grid).toHaveLength(25);
    expect(state.grid.map((c) => c.pokemonId)).toContain(state.yourSecretPokemonId);
  });

  it('n’expose jamais le secret de l’adversaire dans l’état', async () => {
    const state = await startMatch();
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain('opponentSecret');
  });

  it('tour complet : question -> réponse -> minuteur d’élimination -> changement de tour', async () => {
    const first = await startMatch();
    const gameId = first.gameId;

    const q = service.ask('s1', 'Est-il de type Feu ?');
    expect(q.some((e) => e.event === GUESS_WHO_EVENTS.question && e.socketId === 's2')).toBe(true);

    const ans = service.answer('s2', true);
    expect(ans.some((e) => e.event === GUESS_WHO_EVENTS.answered && e.socketId === 's1')).toBe(true);
    const afterAnswer = ans.find((e) => e.event === GUESS_WHO_EVENTS.state)?.payload as GuessWhoStateDTO;
    expect(afterAnswer.phase).toBe('ELIMINATING');
    expect(afterAnswer.turnDeadline).toBeGreaterThan(0);

    // Le 1er tour demarre a la 1re action (l'intro serveur ne s'execute pas sans gateway) :
    // ASKING(1) -> ANSWERING(2). Fin du minuteur d'elimination :
    const expired = service.expire(gameId, 2);
    expect(expired).toHaveLength(2);
    const s1State = expired.find((e) => e.socketId === 's1')?.payload as GuessWhoStateDTO;
    expect(s1State.yourTurn).toBe(false); // le tour est passé à l'adversaire
  });

  it('fin de tour anticipée : le joueur actif clôt l’élimination et passe la main', async () => {
    const first = await startMatch();
    service.ask('s1', 'Est-il de type Feu ?');
    service.answer('s2', true); // phase ELIMINATING, tour de s1
    const ended = service.endTurn('s1');
    expect(ended).toHaveLength(2);
    const s1State = ended.find((e) => e.socketId === 's1')?.payload as GuessWhoStateDTO;
    expect(s1State.phase).toBe('ASKING');
    expect(s1State.yourTurn).toBe(false);
    expect(first.gameId).toBeDefined();
  });

  it('réponse finale : termine la partie et révèle les deux secrets', async () => {
    const state = await startMatch();
    const target = state.grid[0]!.pokemonId; // un id present dans la grille
    const over = service.finalGuess('s1', target);
    expect(over).toHaveLength(2);
    expect(over.every((e) => e.event === GUESS_WHO_EVENTS.over)).toBe(true);
    // Partie retiree : une action ulterieure ne produit plus rien.
    expect(service.ask('s1', 'x')).toHaveLength(0);
  });

  it('réponse finale : un id hors grille est rejeté', async () => {
    await startMatch();
    expect(service.finalGuess('s1', 999999)).toHaveLength(0);
  });

  it('déconnexion en partie : forfait différé, l’adversaire gagne si pas de reconnexion', async () => {
    await startMatch();
    let scheduled: { gameId: string; index: 0 | 1; token: number } | null = null;
    service.onScheduleForfeit = (gameId, index, token) => {
      scheduled = { gameId, index, token };
    };
    const emits = service.handleDisconnect('s1');
    expect(emits).toHaveLength(0); // pas de forfait immediat : delai de grace pour reload / coupure
    expect(scheduled).not.toBeNull();
    const s = scheduled as unknown as { gameId: string; index: 0 | 1; token: number };
    const forfeit = service.forfeitIfStillGone(s.gameId, s.index, s.token);
    expect(forfeit).toHaveLength(2);
    const bobOver = forfeit.find((e) => e.socketId === 's2')?.payload as { youWon: boolean; reason: string };
    expect(bobOver.youWon).toBe(true);
    expect(bobOver.reason).toBe('FORFEIT');
  });

  it('reconnexion pendant le délai de grâce : le forfait est annulé', async () => {
    await startMatch();
    let scheduled: { gameId: string; index: 0 | 1; token: number } | null = null;
    service.onScheduleForfeit = (gameId, index, token) => {
      scheduled = { gameId, index, token };
    };
    service.handleDisconnect('s1');
    // Alice revient avec un nouveau socket (reload / reconnexion).
    const back = service.reconnect({ userId: 'u1', username: 'Alice', socketId: 's1b' });
    expect(back).toHaveLength(1);
    expect(back[0]?.event).toBe(GUESS_WHO_EVENTS.state);
    const s = scheduled as unknown as { gameId: string; index: 0 | 1; token: number };
    expect(service.forfeitIfStillGone(s.gameId, s.index, s.token)).toHaveLength(0);
    // Alice peut de nouveau agir via son nouveau socket.
    const q = service.ask('s1b', 'Est-il de type Eau ?');
    expect(q.some((e) => e.event === GUESS_WHO_EVENTS.question)).toBe(true);
  });

  it('un joueur déjà en partie ne peut pas relancer un matchmaking', async () => {
    await startMatch();
    const res = await service.joinQueue(u1);
    expect(res).toHaveLength(1);
    expect(res[0]?.event).toBe(GUESS_WHO_EVENTS.errorMsg);
  });

  it('salon : création puis rejoint démarre la partie', async () => {
    const created = service.createRoom(u1);
    const code = (created[0]?.payload as { code: string }).code;
    expect(code).toHaveLength(4);
    const start = await service.joinRoom(code, u2);
    expect(start).toHaveLength(2);
    expect(start.every((e) => e.event === GUESS_WHO_EVENTS.state)).toBe(true);
  });
});
