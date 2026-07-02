import { Test, TestingModule } from '@nestjs/testing';
import { GUESS_WHO_EVENTS, type GuessWhoStateDTO } from '@pokegames/shared-types';
import { GuessWhoService } from './guess-who.service';
import { PrismaService } from '../prisma/prisma.service';

const cards = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, nameFr: `P${i + 1}` }));

describe('GuessWhoService', () => {
  let service: GuessWhoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuessWhoService,
        { provide: PrismaService, useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(cards) } } },
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

    const expired = service.expireTurn(gameId, 1);
    expect(expired).toHaveLength(2);
    const s1State = expired.find((e) => e.socketId === 's1')?.payload as GuessWhoStateDTO;
    expect(s1State.yourTurn).toBe(false); // le tour est passé à l'adversaire
  });

  it('réponse finale : termine la partie et révèle les deux secrets', async () => {
    await startMatch();
    const over = service.finalGuess('s1', 1);
    expect(over).toHaveLength(2);
    expect(over.every((e) => e.event === GUESS_WHO_EVENTS.over)).toBe(true);
    // Partie retiree : une action ulterieure ne produit plus rien.
    expect(service.ask('s1', 'x')).toHaveLength(0);
  });

  it('déconnexion en partie : l’adversaire gagne par forfait', async () => {
    await startMatch();
    const emits = service.handleDisconnect('s1');
    expect(emits).toHaveLength(2);
    const bobOver = emits.find((e) => e.socketId === 's2')?.payload as { youWon: boolean; reason: string };
    expect(bobOver.youWon).toBe(true);
    expect(bobOver.reason).toBe('FORFEIT');
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
