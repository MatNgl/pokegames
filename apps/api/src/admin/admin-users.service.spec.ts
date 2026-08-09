import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    gameAuditLog: { groupBy: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
    dailyResult: { count: jest.Mock; findMany: jest.Mock; deleteMany: jest.Mock };
    userPokedexEntry: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    pokemon: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      gameAuditLog: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyResult: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      userPokedexEntry: {
        count: jest.fn().mockResolvedValue(12),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      pokemon: { findMany: jest.fn().mockResolvedValue([]) },
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
    expect(list.total).toBe(2);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]?.gamesPlayed).toBe(5);
    expect(list.items[0]?.totalTimeSeconds).toBe(300);
    expect(list.items[1]?.gamesPlayed).toBe(0);
  });

  it('detail renvoie les infos, agrégats et parties récentes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', username: 'Alice', email: 'a@x.fr', role: 'USER',
      createdAt: new Date('2026-07-01T00:00:00Z'),
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

  describe('assiduité et progression (fiche joueur)', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', username: 'Alice', email: 'a@x.fr', role: 'USER',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      });
      prisma.gameAuditLog.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { durationSeconds: 120 } });
      prisma.dailyResult.count.mockResolvedValue(0);
    });

    it('compte les jours joués distincts et la plus longue série', async () => {
      const today = new Date();
      const jour = (decalage: number) => new Date(today.getTime() - decalage * 24 * 3600 * 1000);
      prisma.gameAuditLog.findMany.mockResolvedValue([
        { createdAt: jour(0) },
        { createdAt: jour(0) }, // meme jour : ne compte qu'une fois
        { createdAt: jour(1) },
        { createdAt: jour(2) },
        { createdAt: jour(9) }, // serie anterieure, isolee
      ]);

      const d = await service.detail('u1');
      expect(d.activeDays).toBe(4);
      expect(d.currentStreakDays).toBe(3); // aujourd'hui, hier, avant-hier
      expect(d.longestStreakDays).toBe(3);
    });

    it('remet la série en cours à zéro après deux jours sans jouer', async () => {
      const today = new Date();
      const jour = (d: number) => new Date(today.getTime() - d * 24 * 3600 * 1000);
      prisma.gameAuditLog.findMany.mockResolvedValue([{ createdAt: jour(5) }, { createdAt: jour(6) }]);

      const d = await service.detail('u1');
      expect(d.currentStreakDays).toBe(0);
      expect(d.longestStreakDays).toBe(2);
    });

    it('répartit les captures du Pokédex par génération', async () => {
      prisma.gameAuditLog.findMany.mockResolvedValue([]);
      prisma.pokemon.findMany.mockResolvedValue([
        { id: 1, generation: 1 }, { id: 2, generation: 1 }, { id: 152, generation: 2 },
      ]);
      prisma.userPokedexEntry.findMany.mockResolvedValue([
        { pokemonId: 1, collectedAt: new Date('2026-07-10T10:00:00Z') },
        { pokemonId: 152, collectedAt: new Date('2026-07-11T10:00:00Z') },
      ]);

      const d = await service.detail('u1');
      expect(d.pokedexCount).toBe(2);
      expect(d.pokedexTotalSpecies).toBe(3);
      expect(d.pokedexByGeneration).toEqual([
        { generation: 1, collected: 1, total: 2 },
        { generation: 2, collected: 1, total: 1 },
      ]);
      // Courbe cumulee des captures
      expect(d.pokedexTimeline).toEqual([
        { date: '2026-07-10', total: 1 },
        { date: '2026-07-11', total: 2 },
      ]);
    });

    it('situe le joueur en centile face aux autres', async () => {
      prisma.gameAuditLog.findMany.mockResolvedValue([]);
      // Le joueur a 3 parties ; deux autres en ont moins, un en a plus.
      prisma.gameAuditLog.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 3 } },
        { userId: 'u2', _count: { _all: 1 } },
        { userId: 'u3', _count: { _all: 2 } },
        { userId: 'u4', _count: { _all: 9 } },
      ]);

      const d = await service.detail('u1');
      expect(d.percentileGames).toBe(50); // devance 2 joueurs sur 4
    });
  });

  it('list trie par nombre de parties quand on le demande', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'Alice', email: 'a@x.fr', role: 'USER', createdAt: new Date() },
      { id: 'u2', username: 'Bob', email: 'b@x.fr', role: 'USER', createdAt: new Date() },
    ]);
    prisma.gameAuditLog.groupBy.mockResolvedValue([
      { userId: 'u2', _count: { _all: 12 }, _sum: { durationSeconds: 100 } },
      { userId: 'u1', _count: { _all: 4 }, _sum: { durationSeconds: 900 } },
    ]);

    const parParties = await service.list(1, undefined, 'games');
    expect(parParties.items.map((u) => u.username)).toEqual(['Bob', 'Alice']);

    const parTemps = await service.list(1, undefined, 'time');
    expect(parTemps.items.map((u) => u.username)).toEqual(['Alice', 'Bob']);
  });

  it('list filtre sur le pseudo ou l’email quand une recherche est fournie', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.gameAuditLog.groupBy.mockResolvedValue([]);
    await service.list(1, 'ali');
    const where = prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where.OR).toEqual([
      { username: { contains: 'ali', mode: 'insensitive' } },
      { email: { contains: 'ali', mode: 'insensitive' } },
    ]);
  });

  describe('updateRole', () => {
    it('promeut un utilisateur en ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' });
      await service.updateRole('u1', 'ADMIN', 'admin1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: 'ADMIN' },
      });
    });

    it('refuse qu’un admin se retire son propre accès', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
      await expect(service.updateRole('admin1', 'USER', 'admin1')).rejects.toThrow(
        'ton propre accès',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuse de rétrograder le dernier administrateur', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'ADMIN' });
      prisma.user.count.mockResolvedValue(1);
      await expect(service.updateRole('u2', 'USER', 'admin1')).rejects.toThrow('dernier administrateur');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('supprime un compte', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' });
      await service.remove('u1', 'admin1');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('refuse la suppression de son propre compte', async () => {
      await expect(service.remove('admin1', 'admin1')).rejects.toThrow('ton propre compte');
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('refuse de supprimer le dernier administrateur', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'ADMIN' });
      prisma.user.count.mockResolvedValue(1);
      await expect(service.remove('u2', 'admin1')).rejects.toThrow('dernier administrateur');
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  it('resetDaily efface les résultats du jour et renvoie le nombre supprimé', async () => {
    const deleted = await service.resetDaily('u1');
    expect(deleted).toBe(3);
    const where = prisma.dailyResult.deleteMany.mock.calls[0]?.[0]?.where;
    expect(where.userId).toBe('u1');
    expect(where.dayDate).toBeInstanceOf(Date);
  });
});
