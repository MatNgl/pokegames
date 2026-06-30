import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhoIsItService } from './who-is-it.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SpriteProxyService } from './sprite-proxy.service';

describe('WhoIsItService', () => {
  let service: WhoIsItService;
  let mockRedisGet: jest.Mock;
  let mockRedisSet: jest.Mock;
  let mockRegisterSpriteSession: jest.Mock;
  let mockRevealSpriteSession: jest.Mock;
  let mockEmit: jest.Mock;

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

    const mockPrismaService = {
      pokemon: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockPokemon]),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhoIsItService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: SpriteProxyService, useValue: mockSpriteProxyService },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
      ],
    }).compile();

    service = module.get<WhoIsItService>(WhoIsItService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startRound', () => {
    it('doit démarrer un round sans divulguer le nom ou l’ID du Pokémon', async () => {
      const state = await service.startRound({ timeLimitSeconds: 30 });

      expect(state.roundId).toBeDefined();
      expect(state.sessionHash).toBeDefined();
      expect(state.status).toBe('PLAYING');
      expect(state.spriteProxyUrl).toContain('/api/sprites/');
      expect(state.hints).toHaveLength(0);

      expect(mockRegisterSpriteSession).toHaveBeenCalledWith(
        state.sessionHash,
        25,
        mockPokemon.spriteRegular,
        90,
      );
    });
  });

  describe('submitGuess', () => {
    it('doit valider une bonne réponse même avec des accents ou majuscules (ex: pÍkâchú)', async () => {
      const startTime = Date.now() - 2000; // 2 secondes écoulées
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        pokemonId: 25,
        pokedexId: 25,
        nameFr: 'Pikachu',
        generation: 1,
        types: ['Électrik'],
        startTime,
        timeLimitSeconds: 30,
        status: 'PLAYING',
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const res = await service.submitGuess('test-round-id', '  pÍkâchú  ');

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.status).toBe('SOLVED');
      expect(res.scoreEarned).toBeGreaterThan(0);
      expect(mockRevealSpriteSession).toHaveBeenCalledWith('test-session-hash');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });

    it('doit refuser une réponse incorrecte et garder le statut PLAYING', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        pokemonId: 25,
        pokedexId: 25,
        nameFr: 'Pikachu',
        generation: 1,
        types: ['Électrik'],
        startTime: Date.now(),
        timeLimitSeconds: 30,
        status: 'PLAYING',
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const res = await service.submitGuess('test-round-id', 'Bulbizarre');

      expect(res.isCorrect).toBe(false);
      expect(res.status).toBe('PLAYING');
      expect(res.revealedPokemon).toBeNull();
    });
  });
});
