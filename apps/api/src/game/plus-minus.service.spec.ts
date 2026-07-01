import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlusMinusService } from './plus-minus.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('PlusMinusService', () => {
  let service: PlusMinusService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;

  const pool = [
    { id: 1, pokedexId: 1, nameFr: 'Bulbizarre', statsHp: 45, statsAtk: 49, statsDef: 49, statsSpeed: 45, height: 0.7, weight: 6.9 },
    { id: 4, pokedexId: 4, nameFr: 'Salamèche', statsHp: 39, statsAtk: 52, statsDef: 43, statsSpeed: 65, height: 0.6, weight: 8.5 },
    { id: 7, pokedexId: 7, nameFr: 'Carapuce', statsHp: 44, statsAtk: 48, statsDef: 65, statsSpeed: 43, height: 0.5, weight: 9.0 },
    { id: 143, pokedexId: 143, nameFr: 'Ronflex', statsHp: 160, statsAtk: 110, statsDef: 65, statsSpeed: 30, height: 2.1, weight: 460 },
  ];

  function duelSession(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      roundId: 'r1',
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      duels: [
        { criterion: 'WEIGHT', a: { id: 1, name: 'Bulbizarre', value: 6.9 }, b: { id: 143, name: 'Ronflex', value: 460 }, correct: 'B' },
        { criterion: 'HP', a: { id: 4, name: 'Salamèche', value: 39 }, b: { id: 7, name: 'Carapuce', value: 44 }, correct: 'B' },
      ],
      ...overrides,
    });
  }

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlusMinusService,
        { provide: PrismaService, useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } } },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
      ],
    }).compile();

    service = module.get<PlusMinusService>(PlusMinusService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche sans exposer les valeurs', async () => {
      const state = await service.startDaily();

      expect(state.roundId).toBeDefined();
      expect(state.totalRounds).toBe(10);
      expect(state.roundIndex).toBe(1);
      expect(state.correctCount).toBe(0);
      expect(state.status).toBe('PLAYING');
      expect(state.criterionLabel.length).toBeGreaterThan(0);
      expect(state.a.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
      expect(state.b.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
      expect('value' in state.a).toBe(false);
    });
  });

  describe('submitChoice', () => {
    it('valide un bon choix, révèle les valeurs et avance à la manche suivante', async () => {
      mockGet.mockResolvedValue(duelSession());

      const res = await service.submitChoice('r1', 'B');

      expect(res.correct).toBe(true);
      expect(res.correctChoice).toBe('B');
      expect(res.revealA.displayValue).toBe('6.9 kg');
      expect(res.revealB.displayValue).toBe('460.0 kg');
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(1);
      expect(res.state.status).toBe('PLAYING');
    });

    it('marque un mauvais choix sans incrémenter le score', async () => {
      mockGet.mockResolvedValue(duelSession());

      const res = await service.submitChoice('r1', 'A');

      expect(res.correct).toBe(false);
      expect(res.correctChoice).toBe('B');
      expect(res.state.correctCount).toBe(0);
    });

    it('termine la partie au dernier duel et émet l’événement d’audit', async () => {
      mockGet.mockResolvedValue(duelSession({ currentIndex: 1, correctCount: 1 }));

      const res = await service.submitChoice('r1', 'B');

      expect(res.state.status).toBe('FINISHED');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });
  });
});
