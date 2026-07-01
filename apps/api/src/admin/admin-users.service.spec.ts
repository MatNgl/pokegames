import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    gameAuditLog: { groupBy: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
    dailyResult: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      gameAuditLog: { groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      dailyResult: { count: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminUsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminUsersService>(AdminUsersService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('list agrège parties jouées et temps joué par utilisateur', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'Alice', email: 'a@x.fr', role: 'USER', createdAt: new Date('2026-07-01T00:00:00Z') },
      { id: 'u2', username: 'Bob', email: 'b@x.fr', role: 'ADMIN', createdAt: new Date('2026-07-01T00:00:00Z') },
    ]);
    prisma.gameAuditLog.groupBy.mockResolvedValue([
      { userId: 'u1', _count: { _all: 5 }, _sum: { durationSeconds: 300 } },
    ]);

    const list = await service.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.gamesPlayed).toBe(5);
    expect(list[0]?.totalTimeSeconds).toBe(300);
    expect(list[1]?.gamesPlayed).toBe(0);
  });

  it('detail renvoie les infos, agrégats et parties récentes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', username: 'Alice', email: 'a@x.fr', role: 'USER',
      createdAt: new Date('2026-07-01T00:00:00Z'), eloScore: 1000,
    });
    prisma.gameAuditLog.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { durationSeconds: 120 } });
    prisma.gameAuditLog.findMany.mockResolvedValue([
      { id: 'g1', gameType: 'MOTUS', userId: 'u1', targetNameFr: 'Pikachu', userGuess: 'Pikachu', isSuccess: true, scoreEarned: 0, durationSeconds: 40, hintsUsedCount: 0, createdAt: new Date('2026-07-01T10:00:00Z') },
    ]);
    prisma.dailyResult.count.mockResolvedValue(7);

    const detail = await service.detail('u1');
    expect(detail.gamesPlayed).toBe(3);
    expect(detail.totalTimeSeconds).toBe(120);
    expect(detail.dailyResultsCount).toBe(7);
    expect(detail.recentGames).toHaveLength(1);
    expect(detail.recentGames[0]?.gameType).toBe('MOTUS');
  });

  it('detail rejette un utilisateur inconnu', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.detail('nope')).rejects.toThrow('Utilisateur introuvable');
  });
});
