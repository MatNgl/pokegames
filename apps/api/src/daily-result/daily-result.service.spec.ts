import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DailyResultService, guestSessionFields, playerFromSession } from './daily-result.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DailyResultService', () => {
  let service: DailyResultService;
  let mockCount: jest.Mock;
  let mockCreate: jest.Mock;
  let mockFindMany: jest.Mock;

  beforeEach(async () => {
    mockCount = jest.fn();
    mockCreate = jest.fn().mockResolvedValue({});
    mockFindMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyResultService,
        {
          provide: PrismaService,
          useValue: {
            dailyResult: { count: mockCount, create: mockCreate, findMany: mockFindMany },
          },
        },
      ],
    }).compile();

    service = module.get<DailyResultService>(DailyResultService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('hasCompleted vrai si un resultat existe pour le jour', async () => {
    mockCount.mockResolvedValue(1);
    await expect(service.hasCompleted('u1', 'PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'))).resolves.toBe(true);
    const where = mockCount.mock.calls[0]?.[0]?.where;
    expect(where.userId).toBe('u1');
    expect(where.dayDate).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it('record persiste les metriques du jour', async () => {
    await service.record({ userId: 'u1' }, 'PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'), {
      won: true,
      correctCount: 8,
      totalRounds: 10,
    });
    const data = mockCreate.mock.calls[0]?.[0]?.data;
    expect(data.userId).toBe('u1');
    expect(data.guestId).toBeNull();
    expect(data.correctCount).toBe(8);
    expect(data.dayDate).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it('record enregistre un invite (guestId + guestName, sans userId)', async () => {
    await service.record(
      { guestId: 'g_abcd', guestName: 'player_abcd' },
      'MOTUS',
      'FACILE',
      new Date('2026-07-01T10:00:00Z'),
      { won: true, attempts: 3 },
    );
    const data = mockCreate.mock.calls[0]?.[0]?.data;
    expect(data.userId).toBeNull();
    expect(data.guestId).toBe('g_abcd');
    expect(data.guestName).toBe('player_abcd');
    expect(data.attempts).toBe(3);
  });

  it('record sans identite de joueur (ni userId ni guestId) : rien enregistre', async () => {
    await service.record({}, 'MOTUS', 'FACILE', new Date('2026-07-01T10:00:00Z'), { won: true });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('leaderboard : un invite est affiche via guestName et marque isGuest', async () => {
    mockFindMany.mockResolvedValue([
      { userId: null, guestId: 'g_1', guestName: 'player_1', won: true, attempts: 2, score: null, correctCount: null, totalRounds: null, durationSeconds: 30, user: null },
    ]);
    const rows = await service.leaderboard('MOTUS', 'FACILE', new Date('2026-07-01T10:00:00Z'));
    expect(rows[0]?.username).toBe('player_1');
    expect(rows[0]?.isGuest).toBe(true);
  });

  it('leaderboard Motus : gagnants d’abord, puis moins d’essais', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'a', won: true, attempts: 4, score: null, correctCount: null, totalRounds: null, durationSeconds: 40, user: { username: 'Alice' } },
      { userId: 'b', won: false, attempts: 6, score: null, correctCount: null, totalRounds: null, durationSeconds: 10, user: { username: 'Bob' } },
      { userId: 'c', won: true, attempts: 2, score: null, correctCount: null, totalRounds: null, durationSeconds: 50, user: { username: 'Cara' } },
    ]);
    const rows = await service.leaderboard('MOTUS', 'FACILE', new Date('2026-07-01T10:00:00Z'));
    expect(rows.map((r) => r.username)).toEqual(['Cara', 'Alice', 'Bob']);
  });

  it('leaderboard jeux a bonnes reponses : plus de correct d’abord, puis plus rapide', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'a', won: false, attempts: null, score: null, correctCount: 8, totalRounds: 10, durationSeconds: 30, user: { username: 'Alice' } },
      { userId: 'b', won: true, attempts: null, score: null, correctCount: 10, totalRounds: 10, durationSeconds: 60, user: { username: 'Bob' } },
      { userId: 'c', won: false, attempts: null, score: null, correctCount: 8, totalRounds: 10, durationSeconds: 20, user: { username: 'Cara' } },
    ]);
    const rows = await service.leaderboard('PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'));
    expect(rows.map((r) => r.username)).toEqual(['Bob', 'Cara', 'Alice']);
  });

  describe('playerFromSession', () => {
    it('le compte prime sur l’invité', () => {
      expect(playerFromSession({ userId: 'u1', guestId: 'g1', guestName: 'player_1' })).toEqual({
        userId: 'u1',
      });
    });

    it('retourne l’identité invité si pas de compte', () => {
      expect(playerFromSession({ guestId: 'g1', guestName: 'player_1' })).toEqual({
        guestId: 'g1',
        guestName: 'player_1',
      });
    });

    it('session anonyme : objet vide', () => {
      expect(playerFromSession({})).toEqual({});
    });
  });

  describe('guestSessionFields', () => {
    it('joueur connecté : aucun champ invité stocké', () => {
      expect(guestSessionFields({ userId: 'u1' })).toEqual({});
    });

    it('joueur anonyme (ni userId ni guestId) : aucun champ', () => {
      expect(guestSessionFields({})).toEqual({});
    });

    it('invité : conserve guestId et guestName', () => {
      expect(guestSessionFields({ guestId: 'g_abcd', guestName: 'player_abcd' })).toEqual({
        guestId: 'g_abcd',
        guestName: 'player_abcd',
      });
    });

    it('invité sans pseudo : repli player_<4 derniers caractères>', () => {
      expect(guestSessionFields({ guestId: 'guest-xy12' })).toEqual({
        guestId: 'guest-xy12',
        guestName: 'player_xy12',
      });
    });

    it('invité sans pseudo et guestId sans caractères alphanumériques : repli player_0000', () => {
      expect(guestSessionFields({ guestId: '----' })).toEqual({
        guestId: '----',
        guestName: 'player_0000',
      });
    });
  });

  describe('claimGuestResultsTx', () => {
    it('migre les lignes invitees non conflictuelles et supprime les doublons du compte', async () => {
      const day = new Date(Date.UTC(2026, 6, 1));
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'r1', gameType: 'MOTUS', scope: 'FACILE', dayDate: day },
          { id: 'r2', gameType: 'SHINY', scope: 'FIND_SHINY:MOYEN', dayDate: day },
        ])
        .mockResolvedValueOnce([{ gameType: 'MOTUS', scope: 'FACILE', dayDate: day }]);
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const tx = {
        dailyResult: { findMany, updateMany, deleteMany },
      } as unknown as Prisma.TransactionClient;

      await service.claimGuestResultsTx(tx, 'user-1', 'g_abcd');

      // r2 (aucun equivalent chez le compte) est migre ; r1 (MOTUS/FACILE deja possede) est supprime.
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['r2'] } },
        data: { userId: 'user-1', guestId: null, guestName: null },
      });
      expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['r1'] } } });
    });

    it('aucune ligne invitee : ne migre ni ne supprime rien', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const updateMany = jest.fn();
      const deleteMany = jest.fn();
      const tx = {
        dailyResult: { findMany, updateMany, deleteMany },
      } as unknown as Prisma.TransactionClient;

      await service.claimGuestResultsTx(tx, 'user-1', 'g_none');

      expect(updateMany).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });
  });

  it('record est idempotent : ignore le doublon (verrou strict)', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
    });
    mockCreate.mockRejectedValueOnce(dup);
    await expect(
      service.record({ userId: 'u1' }, 'PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'), {
        won: true,
      }),
    ).resolves.toBeUndefined();
  });
});
