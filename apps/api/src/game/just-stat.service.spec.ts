import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JustStatService } from './just-stat.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

const pool = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  nameFr: `Pokemon${i + 1}`,
  statsHp: 40 + i,
  statsAtk: 50 + i,
  statsDef: 60 + i,
  statsSpeAtk: 70 + i,
  statsSpeDef: 80 + i,
  statsSpeed: 90 + i,
  height: 0.5 + i * 0.1,
  weight: 6 + i,
}));

describe('JustStatService', () => {
  let service: JustStatService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JustStatService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } },
        },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
        {
          provide: HistoryService,
          useValue: {
            recentPokemonIds: jest.fn().mockResolvedValue(new Set<number>()),
            recentDetails: jest.fn().mockResolvedValue(new Set<string>()),
            hasPicksFor: jest.fn().mockResolvedValue(false),
            recordPicks: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DailyResultService,
          useValue: {
            hasCompleted: jest.fn().mockResolvedValue(false),
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: GameConfigService, useValue: gameConfigMock() },
      ],
    }).compile();

    service = module.get<JustStatService>(JustStatService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche sans révéler la valeur cible', async () => {
      const state = await service.startDaily();

      expect(state.roundId).toBeDefined();
      expect(state.totalRounds).toBe(3);
      expect(state.roundIndex).toBe(1);
      expect(state.status).toBe('PLAYING');
      expect(state.pokemon.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
      expect(state.statLabel.length).toBeGreaterThan(0);
      expect(state.timeLimitSeconds).toBe(20);
      expect(state.attemptsRemaining).toBe(state.maxAttempts);
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('"value"');
    });

    it('varie les Pokémon et les stats sur les 3 manches (intra-session)', async () => {
      await service.startDaily();
      const session = JSON.parse(mockSet.mock.calls[0]?.[1] as string) as {
        rounds: { pokemonId: number; stat: string }[];
      };
      const ids = session.rounds.map((r) => r.pokemonId);
      const stats = session.rounds.map((r) => r.stat);
      expect(new Set(ids).size).toBe(3);
      expect(new Set(stats).size).toBe(3);
    });
  });

  describe('guess', () => {
    function session(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        roundId: 'r1',
        currentIndex: 0,
        correctCount: 0,
        status: 'PLAYING',
        startTime: Date.now(),
        rounds: [
          { pokemonId: 1, name: 'Pokemon1', stat: 'SPEED', value: 100, attemptsUsed: 0, solved: false, over: false },
          { pokemonId: 2, name: 'Pokemon2', stat: 'HP', value: 42, attemptsUsed: 0, solved: false, over: false },
          { pokemonId: 3, name: 'Pokemon3', stat: 'ATK', value: 55, attemptsUsed: 0, solved: false, over: false },
        ],
        ...overrides,
      });
    }

    it('indique HIGHER quand la proposition est trop basse', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.guess('r1', 80);

      expect(res.direction).toBe('HIGHER');
      expect(res.roundOver).toBe(false);
      expect(res.correctValue).toBeNull();
      expect(res.attemptsRemaining).toBe(14);
      expect(res.state.roundIndex).toBe(1);
    });

    it('indique LOWER quand la proposition est trop haute', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.guess('r1', 130);

      expect(res.direction).toBe('LOWER');
      expect(res.roundOver).toBe(false);
    });

    it('valide la bonne valeur, révèle la cible et avance', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.guess('r1', 100);

      expect(res.direction).toBe('CORRECT');
      expect(res.roundOver).toBe(true);
      expect(res.correctValue).toBe(100);
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(1);
    });

    it('termine la manche sans point après le dernier essai raté', async () => {
      mockGet.mockResolvedValue(session({ rounds: [
        { pokemonId: 1, name: 'Pokemon1', stat: 'SPEED', value: 100, attemptsUsed: 14, solved: false, over: false },
        { pokemonId: 2, name: 'Pokemon2', stat: 'HP', value: 42, attemptsUsed: 0, solved: false, over: false },
        { pokemonId: 3, name: 'Pokemon3', stat: 'ATK', value: 55, attemptsUsed: 0, solved: false, over: false },
      ] }));

      const res = await service.guess('r1', 90);

      expect(res.direction).toBe('HIGHER');
      expect(res.roundOver).toBe(true);
      expect(res.correctValue).toBe(100);
      expect(res.state.correctCount).toBe(0);
    });

    it('émet l’événement d’audit à la fin de la partie', async () => {
      mockGet.mockResolvedValue(session({ currentIndex: 2, correctCount: 2 }));

      const res = await service.guess('r1', 55);

      expect(res.state.status).toBe('FINISHED');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });
  });

  describe('timeout', () => {
    it('termine la manche courante, révèle la valeur et avance', async () => {
      mockGet.mockResolvedValue(
        JSON.stringify({
          roundId: 'r1',
          currentIndex: 0,
          correctCount: 0,
          status: 'PLAYING',
          startTime: Date.now(),
          rounds: [
            { pokemonId: 1, name: 'Pokemon1', stat: 'SPEED', value: 100, attemptsUsed: 3, solved: false, over: false },
            { pokemonId: 2, name: 'Pokemon2', stat: 'HP', value: 42, attemptsUsed: 0, solved: false, over: false },
            { pokemonId: 3, name: 'Pokemon3', stat: 'ATK', value: 55, attemptsUsed: 0, solved: false, over: false },
          ],
        }),
      );

      const res = await service.timeout('r1');

      expect(res.direction).toBeNull();
      expect(res.roundOver).toBe(true);
      expect(res.correctValue).toBe(100);
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(0);
    });
  });
});
