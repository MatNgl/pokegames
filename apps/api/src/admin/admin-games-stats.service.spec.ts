import { Test, TestingModule } from '@nestjs/testing';
import { AdminGamesStatsService } from './admin-games-stats.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminGamesStatsService', () => {
  let service: AdminGamesStatsService;
  let prisma: {
    gameAuditLog: { findMany: jest.Mock };
    dailyResult: { findMany: jest.Mock };
    pokemon: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      gameAuditLog: { findMany: jest.fn().mockResolvedValue([]) },
      dailyResult: { findMany: jest.fn().mockResolvedValue([]) },
      pokemon: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGamesStatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminGamesStatsService>(AdminGamesStatsService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('calcule la difficulté par niveau à partir des bonnes réponses', async () => {
    prisma.dailyResult.findMany.mockResolvedValue([
      { gameType: 'SHINY', scope: 'FACILE', won: true, attempts: null, correctCount: 4, totalRounds: 5, durationSeconds: 30 },
      { gameType: 'SHINY', scope: 'FACILE', won: true, attempts: null, correctCount: 5, totalRounds: 5, durationSeconds: 50 },
      { gameType: 'SHINY', scope: 'DIFFICILE', won: false, attempts: null, correctCount: 1, totalRounds: 5, durationSeconds: 20 },
    ]);

    const r = await service.getReport(30);
    const facile = r.levels.find((l) => l.scope === 'FACILE');
    const difficile = r.levels.find((l) => l.scope === 'DIFFICILE');
    expect(facile?.successRatePct).toBe(90); // 9 bonnes sur 10
    expect(facile?.medianDurationSeconds).toBe(40);
    expect(difficile?.successRatePct).toBe(20);
  });

  it('classe les Pokémon les plus ratés et ignore ceux vus trop peu de fois', async () => {
    const rows = [
      // Rate 3 fois sur 4 : eligible (>= 3 parties)
      ...Array.from({ length: 4 }, (_, i) => ({
        gameType: 'WHO_IS_IT', targetPokemonId: 1, targetNameFr: 'Ptitard',
        isSuccess: i === 0, durationSeconds: 10, hintsUsedCount: 0,
      })),
      // Toujours trouve, 3 parties : eligible
      ...Array.from({ length: 3 }, () => ({
        gameType: 'WHO_IS_IT', targetPokemonId: 25, targetNameFr: 'Pikachu',
        isSuccess: true, durationSeconds: 5, hintsUsedCount: 0,
      })),
      // Une seule partie : sous le seuil, doit etre exclu des deux classements
      { gameType: 'WHO_IS_IT', targetPokemonId: 99, targetNameFr: 'Rarissime', isSuccess: false, durationSeconds: 9, hintsUsedCount: 0 },
    ];
    prisma.gameAuditLog.findMany.mockResolvedValue(rows);

    const r = await service.getReport(30);
    expect(r.hardestPokemon[0]?.nameFr).toBe('Ptitard');
    expect(r.hardestPokemon[0]?.successRatePct).toBe(25);
    expect(r.easiestPokemon[0]?.nameFr).toBe('Pikachu');
    const ids = [...r.hardestPokemon, ...r.easiestPokemon].map((p) => p.pokemonId);
    expect(ids).not.toContain(99);
  });

  it('construit l’histogramme des essais pour les jeux concernés', async () => {
    prisma.dailyResult.findMany.mockResolvedValue([
      { gameType: 'MOTUS', scope: '', won: true, attempts: 3, correctCount: null, totalRounds: null, durationSeconds: 10 },
      { gameType: 'MOTUS', scope: '', won: true, attempts: 3, correctCount: null, totalRounds: null, durationSeconds: 10 },
      { gameType: 'MOTUS', scope: '', won: true, attempts: 5, correctCount: null, totalRounds: null, durationSeconds: 10 },
      { gameType: 'SHINY', scope: '', won: true, attempts: null, correctCount: 3, totalRounds: 5, durationSeconds: 10 },
    ]);

    const r = await service.getReport(30);
    const motus = r.attempts.find((a) => a.gameType === 'MOTUS');
    expect(motus?.buckets).toEqual([
      { attempts: 3, count: 2 },
      { attempts: 5, count: 1 },
    ]);
    // SHINY n'a pas d'essais : absent de l'histogramme
    expect(r.attempts.find((a) => a.gameType === 'SHINY')).toBeUndefined();
  });

  it('mesure l’usage des indices et son effet sur la réussite', async () => {
    prisma.gameAuditLog.findMany.mockResolvedValue([
      { gameType: 'WHO_IS_IT', targetPokemonId: 1, targetNameFr: 'A', isSuccess: true, durationSeconds: 10, hintsUsedCount: 2 },
      { gameType: 'WHO_IS_IT', targetPokemonId: 2, targetNameFr: 'B', isSuccess: false, durationSeconds: 10, hintsUsedCount: 2 },
      { gameType: 'WHO_IS_IT', targetPokemonId: 3, targetNameFr: 'C', isSuccess: true, durationSeconds: 10, hintsUsedCount: 0 },
    ]);

    const r = await service.getReport(30);
    const h = r.hints.find((x) => x.gameType === 'WHO_IS_IT');
    expect(h?.avgHints).toBeCloseTo(1.33, 1);
    expect(h?.successWithHintsPct).toBe(50);
    expect(h?.successWithoutHintsPct).toBe(100);
  });
});
