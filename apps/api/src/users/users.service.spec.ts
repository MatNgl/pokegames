import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockFindUnique: jest.Mock;
  let mockFindManyHistory: jest.Mock;
  let mockFindManyUsers: jest.Mock;

  beforeEach(async () => {
    mockFindUnique = jest.fn();
    mockFindManyHistory = jest.fn();
    mockFindManyUsers = jest.fn();

    const mockPrismaService = {
      user: {
        findUnique: mockFindUnique,
        findMany: mockFindManyUsers,
      },
      gameHistory: {
        findMany: mockFindManyHistory,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('doit renvoyer le profil du joueur', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u-1',
      email: 'test@example.com',
      username: 'red',
      role: 'USER',
      eloScore: 1200,
      createdAt: new Date(),
    });

    const res = await service.getProfile('u-1');
    expect(res.username).toBe('red');
    expect(res.eloScore).toBe(1200);
  });

  it('doit lever NotFoundException si l’utilisateur est introuvable', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(service.getProfile('invalid')).rejects.toThrow(NotFoundException);
  });

  it('doit renvoyer l’historique des parties d’un joueur', async () => {
    mockFindManyHistory.mockResolvedValue([
      {
        id: 'h-1',
        userId: 'u-1',
        gameType: 'WHO_IS_IT',
        score: 850,
        playedAt: new Date(),
        isMulti: false,
      },
    ]);

    const history = await service.getPlayerHistory('u-1');
    expect(history).toHaveLength(1);
    expect(history[0]?.score).toBe(850);
  });
});
