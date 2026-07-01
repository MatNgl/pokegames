import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HistoryService', () => {
  let service: HistoryService;
  let mockCount: jest.Mock;
  let mockCreateMany: jest.Mock;
  let mockFindMany: jest.Mock;

  beforeEach(async () => {
    mockCount = jest.fn();
    mockCreateMany = jest.fn().mockResolvedValue({ count: 0 });
    mockFindMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: PrismaService,
          useValue: {
            dailyPick: { count: mockCount, createMany: mockCreateMany, findMany: mockFindMany },
          },
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('recordPicks', () => {
    it('enregistre les tirages a minuit UTC, pokemonId/detail normalises', async () => {
      await service.recordPicks('MOTUS', 'FACILE', new Date('2026-07-01T18:30:00Z'), [
        { pokemonId: 25 },
        { detail: 'SPEED' },
      ]);

      expect(mockCreateMany).toHaveBeenCalledTimes(1);
      const arg = mockCreateMany.mock.calls[0]?.[0] as { data: Array<Record<string, unknown>> };
      expect(arg.data).toHaveLength(2);
      expect(arg.data[0]).toEqual({
        game: 'MOTUS',
        scope: 'FACILE',
        pickDate: new Date(Date.UTC(2026, 6, 1)),
        pokemonId: 25,
        detail: null,
      });
      expect(arg.data[1]?.pokemonId).toBeNull();
      expect(arg.data[1]?.detail).toBe('SPEED');
    });

    it('ne fait rien si la liste est vide', async () => {
      await service.recordPicks('MOTUS', '', new Date(), []);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('hasPicksFor', () => {
    it('vrai si au moins un tirage existe pour le jour', async () => {
      mockCount.mockResolvedValue(3);
      await expect(service.hasPicksFor('SHINY', 'FIND_SHINY', new Date('2026-07-01T00:00:00Z'))).resolves.toBe(
        true,
      );
      const where = (mockCount.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
      expect(where).toEqual({
        game: 'SHINY',
        scope: 'FIND_SHINY',
        pickDate: new Date(Date.UTC(2026, 6, 1)),
      });
    });

    it('faux si aucun tirage', async () => {
      mockCount.mockResolvedValue(0);
      await expect(service.hasPicksFor('SHINY', '', new Date())).resolves.toBe(false);
    });
  });

  describe('recentPokemonIds', () => {
    it('interroge la fenetre [jour - days, jour) et renvoie un Set sans null', async () => {
      mockFindMany.mockResolvedValue([{ pokemonId: 1 }, { pokemonId: 4 }, { pokemonId: null }]);

      const ids = await service.recentPokemonIds('INTRUDER', '', new Date('2026-07-01T12:00:00Z'), 7);

      expect(ids).toEqual(new Set([1, 4]));
      const where = (mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
      expect(where.pickDate).toEqual({
        gte: new Date(Date.UTC(2026, 5, 24)),
        lt: new Date(Date.UTC(2026, 6, 1)),
      });
    });
  });

  describe('recentDetails', () => {
    it('renvoie les dimensions secondaires recentes sans null', async () => {
      mockFindMany.mockResolvedValue([{ detail: 'SPEED' }, { detail: 'HP' }, { detail: null }]);

      const details = await service.recentDetails('JUST_STAT', '', new Date('2026-07-01T00:00:00Z'), 3);

      expect(details).toEqual(new Set(['SPEED', 'HP']));
    });
  });
});
