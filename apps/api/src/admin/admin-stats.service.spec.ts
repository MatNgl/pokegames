import { Test, TestingModule } from '@nestjs/testing';
import { AdminStatsService } from './admin-stats.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminStatsService', () => {
  let service: AdminStatsService;
  let prisma: {
    gameAuditLog: { count: jest.Mock; findMany: jest.Mock };
    user: { count: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      gameAuditLog: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      user: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminStatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminStatsService>(AdminStatsService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('getStats calcule le taux de réussite et la médiane de durée par jeu', async () => {
    prisma.gameAuditLog.count.mockResolvedValue(4);
    prisma.user.count.mockResolvedValue(2);
    prisma.gameAuditLog.findMany
      .mockResolvedValueOnce([{ userId: 'u1' }]) // actifs aujourd'hui
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]) // actifs 7j
      .mockResolvedValueOnce([
        { gameType: 'MOTUS', durationSeconds: 10, isSuccess: true },
        { gameType: 'MOTUS', durationSeconds: 20, isSuccess: true },
        { gameType: 'MOTUS', durationSeconds: 30, isSuccess: false },
        { gameType: 'WHO_IS_IT', durationSeconds: 50, isSuccess: true },
      ]);

    const stats = await service.getStats();

    expect(stats.activeUsersToday).toBe(1);
    expect(stats.activeUsers7d).toBe(2);
    const motus = stats.perGame.find((g) => g.gameType === 'MOTUS');
    expect(motus?.games).toBe(3);
    expect(motus?.medianDurationSeconds).toBe(20);
    expect(motus?.successRatePct).toBe(67);
    // Trie par volume decroissant : MOTUS (3) avant WHO_IS_IT (1).
    expect(stats.perGame[0]?.gameType).toBe('MOTUS');
  });

  it('getAnomalies signale les manches résolues trop vite', async () => {
    prisma.gameAuditLog.findMany
      .mockResolvedValueOnce([
        { userId: 'u1', gameType: 'MOTUS', durationSeconds: 1, createdAt: new Date('2026-07-05T10:00:00Z') },
        { userId: 'u1', gameType: 'MOTUS', durationSeconds: 0, createdAt: new Date('2026-07-05T09:00:00Z') },
      ])
      .mockResolvedValueOnce([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', username: 'Tricheur' }]);

    const anomalies = await service.getAnomalies();
    const fast = anomalies.find((a) => a.kind === 'FAST_SOLVE');
    expect(fast?.username).toBe('Tricheur');
    expect(fast?.count).toBe(2);
  });

  it('getAnomalies signale une série de réussites anormale', async () => {
    const rows = Array.from({ length: 16 }, (_, i) => ({
      userId: 'u2',
      gameType: 'SHINY',
      isSuccess: true,
      createdAt: new Date(`2026-07-05T10:${String(i).padStart(2, '0')}:00Z`),
    }));
    prisma.gameAuditLog.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
    prisma.user.findMany.mockResolvedValue([{ id: 'u2', username: 'Parfait' }]);

    const anomalies = await service.getAnomalies();
    const streak = anomalies.find((a) => a.kind === 'PERFECT_STREAK');
    expect(streak?.username).toBe('Parfait');
    expect(streak?.count).toBeGreaterThanOrEqual(15);
  });

  it('getAnomalies ne signale rien quand un échec casse la série', async () => {
    const rows = Array.from({ length: 16 }, (_, i) => ({
      userId: 'u3',
      gameType: 'SHINY',
      isSuccess: i !== 5,
      createdAt: new Date('2026-07-05T10:00:00Z'),
    }));
    prisma.gameAuditLog.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
    prisma.user.findMany.mockResolvedValue([{ id: 'u3', username: 'Normal' }]);

    const anomalies = await service.getAnomalies();
    expect(anomalies.filter((a) => a.kind === 'PERFECT_STREAK')).toHaveLength(0);
  });
});
