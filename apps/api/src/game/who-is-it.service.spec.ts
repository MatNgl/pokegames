import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhoIsItService } from './who-is-it.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SpriteProxyService } from './sprite-proxy.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

describe('WhoIsItService', () => {
  let service: WhoIsItService;
  let mockRedisGet: jest.Mock;
  let mockRedisSet: jest.Mock;
  let mockRegisterSpriteSession: jest.Mock;
  let mockRevealSpriteSession: jest.Mock;
  let mockEmit: jest.Mock;
  let mockFindMany: jest.Mock;

  const mockPokemon = {
    id: 25,
    pokedexId: 25,
    nameFr: 'Pikachu',
    nameEn: 'Pikachu',
    category: 'Souris',
    generation: 1,
    spriteRegular: 'https://example.com/pikachu.png',
    spriteShiny: null,
    statsHp: 35,
    statsAtk: 55,
    statsDef: 40,
    statsSpeAtk: 50,
    statsSpeDef: 50,
    statsSpeed: 90,
    weight: 6.0,
    height: 0.4,
    createdAt: new Date(),
    updatedAt: new Date(),
    types: [
      {
        pokemonId: 25,
        typeId: 1,
        slot: 1,
        type: { id: 1, nameFr: 'Électrik', nameEn: 'Electric', image: 'https://example.com/elec.png' },
      },
    ],
  };

  beforeEach(async () => {
    mockRedisGet = jest.fn();
    mockRedisSet = jest.fn().mockResolvedValue(undefined);
    mockRegisterSpriteSession = jest.fn().mockResolvedValue(undefined);
    mockRevealSpriteSession = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);
    mockFindMany = jest.fn().mockResolvedValue([mockPokemon]);

    const mockPrismaService = {
      pokemon: {
        count: jest.fn().mockResolvedValue(1),
        findMany: mockFindMany,
        findUnique: jest.fn().mockResolvedValue({
          ...mockPokemon,
          evolutions: [],
          evolvedFrom: [],
        }),
      },
      gameHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const mockRedisService: Partial<RedisService> = {
      set: mockRedisSet,
      get: mockRedisGet,
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockSpriteProxyService: Partial<SpriteProxyService> = {
      registerSpriteSession: mockRegisterSpriteSession,
      revealSpriteSession: mockRevealSpriteSession,
      setColorLevel: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhoIsItService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: SpriteProxyService, useValue: mockSpriteProxyService },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
        {
          provide: HistoryService,
          useValue: {
            recentPokemonIds: jest.fn().mockResolvedValue(new Set<number>()),
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

    service = module.get<WhoIsItService>(WhoIsItService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startRound', () => {
    it('doit démarrer un round avec un capital de 100 points et des indices masqués', async () => {
      const state = await service.startRound({ generations: [1], mode: 'CLASSIC' });

      expect(state.roundId).toBeDefined();
      expect(state.sessionHash).toBeDefined();
      expect(state.status).toBe('PLAYING');
      expect(state.currentScore).toBe(100);
      expect(state.hints).toHaveLength(4);
      expect(state.hints.every((h) => !h.isRevealed)).toBe(true);

      expect(mockRegisterSpriteSession).toHaveBeenCalledWith(
        state.sessionHash,
        25,
        mockPokemon.spriteRegular,
        3600,
      );
    });
  });

  describe('niveaux et indices', () => {
    it('Facile : zoom 1.0 et aucune rotation', async () => {
      const state = await service.startRound({ generations: [1], level: 'FACILE' });
      expect(state.zoomRatio).toBe(1.0);
      expect(state.rotationAngle).toBe(0);
    });

    it('Difficile : zoom et rotation initiaux du niveau', async () => {
      const state = await service.startRound({ generations: [1], level: 'DIFFICILE' });
      expect(state.zoomRatio).toBe(2.6);
      expect(state.rotationAngle).toBe(30);
    });

    it('l’indice Taille affiche la hauteur en mètres (jamais divisée)', async () => {
      const state = await service.startRound({ generations: [1], level: 'MOYEN' });
      const heightHint = state.hints.find((h) => h.type === 'HEIGHT');
      expect(heightHint?.value).toBe('0.4 m');
    });

    it('rejette un niveau invalide', async () => {
      await expect(
        service.startRound({ generations: [1], level: 'IMPOSSIBLE' as never }),
      ).rejects.toThrow();
    });

    it('série quotidienne : Moyen, Difficile et Extrême tirent des Pokémon différents', async () => {
      const catalog = Array.from({ length: 40 }, (_, i) => ({
        ...mockPokemon,
        id: i + 1,
        pokedexId: i + 1,
        nameFr: `P${i + 1}`,
        generation: (i % 9) + 1,
      }));
      mockFindMany.mockResolvedValue(catalog);

      await service.startRound({ generations: [], mode: 'DAILY', level: 'MOYEN' });
      await service.startRound({ generations: [], mode: 'DAILY', level: 'DIFFICILE' });
      await service.startRound({ generations: [], mode: 'DAILY', level: 'EXTREME' });

      // registerSpriteSession(sessionHash, pokemonId, ...) : le 2e argument est l'id de la cible.
      const targetIds = mockRegisterSpriteSession.mock.calls.slice(-3).map((call) => call[1]);
      expect(new Set(targetIds).size).toBe(3);
    });
  });

  describe('submitGuess', () => {
    it('doit valider une bonne réponse et émettre l’événement d’audit avec le score actuel', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now() - 2000,
        currentScore: 100,
        mistakesCount: 0,
        hintsUsedCount: 0,
        mode: 'CLASSIC',
        roundIndex: 1,
        totalRounds: 5,
        hints: [],
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const res = await service.submitGuess('test-round-id', '  pÍkâchú  ');

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.status).toBe('SOLVED');
      expect(res.currentScore).toBe(100);
      expect(mockRevealSpriteSession).toHaveBeenCalledWith('test-session-hash');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });

    it('doit pénaliser une mauvaise réponse (-15 points) sans clore la manche', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now(),
        currentScore: 100,
        mistakesCount: 0,
        hintsUsedCount: 0,
        mode: 'CLASSIC',
        roundIndex: 1,
        totalRounds: 5,
        hints: [],
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const res = await service.submitGuess('test-round-id', 'Bulbizarre');

      expect(res.isCorrect).toBe(false);
      expect(res.status).toBe('PLAYING');
      expect(res.currentScore).toBe(85);
      expect(res.mistakesCount).toBe(1);
      expect(res.revealedPokemon).toBeNull();
    });
  });

  describe('requestHint', () => {
    it('doit débloquer l’indice si le palier d’erreur est atteint et réduire le score (-10 points)', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now(),
        currentScore: 85,
        mistakesCount: 1,
        hintsUsedCount: 0,
        mode: 'CLASSIC',
        roundIndex: 1,
        totalRounds: 5,
        hints: [
          {
            type: 'FIRST_LETTER',
            label: 'Première lettre',
            value: 'P...',
            cost: 10,
            unlockedAtMistakeCount: 1,
            isRevealed: false,
          },
        ],
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const state = await service.requestHint('test-round-id', 'FIRST_LETTER');

      expect(state.currentScore).toBe(75);
      expect(state.hints[0]?.isRevealed).toBe(true);
    });
  });
});
