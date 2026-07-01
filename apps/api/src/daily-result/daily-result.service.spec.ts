import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DailyResultService } from './daily-result.service';
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
    await service.record('u1', 'PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'), {
      won: true,
      correctCount: 8,
      totalRounds: 10,
    });
    const data = mockCreate.mock.calls[0]?.[0]?.data;
    expect(data.userId).toBe('u1');
    expect(data.correctCount).toBe(8);
    expect(data.dayDate).toEqual(new Date(Date.UTC(2026, 6, 1)));
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

  it('record est idempotent : ignore le doublon (verrou strict)', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
    });
    mockCreate.mockRejectedValueOnce(dup);
    await expect(
      service.record('u1', 'PLUS_MINUS', 'FACILE', new Date('2026-07-01T10:00:00Z'), { won: true }),
    ).resolves.toBeUndefined();
  });
});
