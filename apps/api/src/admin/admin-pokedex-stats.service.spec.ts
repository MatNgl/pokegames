import { Test, TestingModule } from '@nestjs/testing';
import { AdminPokedexStatsService } from './admin-pokedex-stats.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminPokedexStatsService', () => {
  let service: AdminPokedexStatsService;
  let prisma: {
    pokedexSpawn: { groupBy: jest.Mock };
    pokemon: { count: jest.Mock; findFirst: jest.Mock };
    userPokedexEntry: { count: jest.Mock; findMany: jest.Mock };
    dailyPick: { groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      pokedexSpawn: { groupBy: jest.fn().mockResolvedValue([]) },
      pokemon: { count: jest.fn().mockResolvedValue(1025), findFirst: jest.fn().mockResolvedValue(null) },
      userPokedexEntry: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      dailyPick: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminPokedexStatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminPokedexStatsService>(AdminPokedexStatsService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('calcule le taux de collecte par zone, les moins bonnes en tête', async () => {
    prisma.pokedexSpawn.groupBy.mockResolvedValue([
      { zone: 'home', collected: true, _count: { _all: 8 } },
      { zone: 'home', collected: false, _count: { _all: 2 } },
      { zone: 'motus', collected: true, _count: { _all: 1 } },
      { zone: 'motus', collected: false, _count: { _all: 9 } },
    ]);

    const r = await service.getReport();
    // Trie par taux croissant : la zone problematique remonte en premier.
    expect(r.zones[0]?.zone).toBe('motus');
    expect(r.zones[0]?.ratePct).toBe(10);
    expect(r.zones[0]?.spawned).toBe(10);
    expect(r.zones[1]?.zone).toBe('home');
    expect(r.zones[1]?.ratePct).toBe(80);
  });

  it('calcule la progression moyenne du Pokédex sur les seuls collectionneurs', async () => {
    prisma.userPokedexEntry.count.mockResolvedValue(30);
    prisma.userPokedexEntry.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    prisma.pokemon.count.mockResolvedValue(1000);

    const r = await service.getReport();
    expect(r.collectors).toBe(2);
    expect(r.avgCollected).toBe(15);
    expect(r.avgPct).toBe(1.5);
  });

  it('renvoie l’état du catalogue et les tirages du jour', async () => {
    prisma.pokemon.count
      .mockResolvedValueOnce(1025) // total
      .mockResolvedValueOnce(900) // avec sprite shiny
      .mockResolvedValueOnce(48); // avec mega
    prisma.pokemon.findFirst.mockResolvedValue({ updatedAt: new Date('2026-07-20T08:00:00Z') });
    prisma.dailyPick.groupBy.mockResolvedValue([
      { game: 'MOTUS', scope: 'FACILE', _count: { _all: 1 } },
    ]);

    const info = await service.getSystemInfo(new Date('2026-07-25T12:00:00Z'));
    expect(info.pokemonCount).toBe(1025);
    expect(info.withShinySprite).toBe(900);
    expect(info.withMega).toBe(48);
    expect(info.lastPokemonUpdate).toContain('2026-07-20');
    expect(info.todayPicks).toEqual([{ game: 'MOTUS', scope: 'FACILE', count: 1 }]);
  });
});
