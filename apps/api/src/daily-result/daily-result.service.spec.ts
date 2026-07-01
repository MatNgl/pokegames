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
