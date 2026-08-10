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
  let mockRecord: jest.Mock;

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
    mockRecord = jest.fn().mockResolvedValue(undefined);

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
            record: mockRecord,
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

    it('enregistre l’identité invité dans la session (guestId + guestName, sans userId)', async () => {
      await service.startRound({ generations: [1] }, { guestId: 'g_abcd', guestName: 'player_abcd' });
      const session = JSON.parse(
        mockRedisSet.mock.calls[mockRedisSet.mock.calls.length - 1]?.[1] as string,
      ) as { userId?: string; guestId?: string; guestName?: string };
      expect(session.userId).toBeUndefined();
      expect(session.guestId).toBe('g_abcd');
      expect(session.guestName).toBe('player_abcd');
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

    it('l’indice Taille affiche la hauteur en mètres (jamais divisée) une fois révélé', async () => {
      const state = await service.startRound({ generations: [1], level: 'MOYEN' });
      const session = JSON.parse(
        mockRedisSet.mock.calls[mockRedisSet.mock.calls.length - 1]?.[1] as string,
      ) as { hints: { type: string; value: unknown }[] };
      // La valeur reste cote serveur, elle n'est envoyee qu'apres revelation (voir anti-triche).
      expect(session.hints.find((h) => h.type === 'HEIGHT')?.value).toBe('0.4 m');
      expect(state.hints.find((h) => h.type === 'HEIGHT')?.value).toBeNull();
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

    it("doit compter une erreur sur une mauvaise réponse sans clore la manche (score inchangé, plus de points)", async () => {
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
      expect(res.currentScore).toBe(100);
      expect(res.mistakesCount).toBe(1);
      expect(res.revealedPokemon).toBeNull();
    });

    it('défi quotidien terminé par un invité : record reçoit l’identité invité', async () => {
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
        mode: 'DAILY',
        level: 'MOYEN',
        roundIndex: 5,
        totalRounds: 5,
        hints: [],
        guestId: 'g_abcd',
        guestName: 'player_abcd',
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      await service.submitGuess('test-round-id', 'Pikachu');

      expect(mockRecord).toHaveBeenCalledWith(
        { guestId: 'g_abcd', guestName: 'player_abcd' },
        expect.any(String),
        'MOYEN',
        expect.any(Date),
        expect.objectContaining({ won: true, attempts: 1 }),
      );
    });
  });

  describe('skipRound', () => {
    it('doit révéler le Pokémon et clore la manche sans toucher au score (classement par essais)', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now(),
        currentScore: 100,
        mistakesCount: 2,
        hintsUsedCount: 1,
        mode: 'CLASSIC',
        roundIndex: 1,
        totalRounds: 5,
        hints: [],
      };

      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const res = await service.skipRound('test-round-id');

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.status).toBe('SOLVED');
      expect(res.currentScore).toBe(100); // plus de points : le classement se fait au nombre d'essais
      expect(res.mistakesCount).toBe(2); // inchangé : le "passer" ne compte pas comme une erreur en plus
      expect(res.revealedPokemon?.nameFr).toBe('Pikachu');
      expect(mockRevealSpriteSession).toHaveBeenCalledWith('test-session-hash');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });

    it('rejette un skip sur une manche déjà terminée', async () => {
      const mockSession = {
        roundId: 'test-round-id',
        sessionHash: 'test-session-hash',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'SOLVED',
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

      await expect(service.skipRound('test-round-id')).rejects.toThrow();
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
      // Revele : la valeur est desormais transmise.
      expect(state.hints[0]?.value).toBe('P...');
    });
  });

  /**
   * Regle 2 : la reponse reseau ne doit jamais porter de quoi identifier le Pokemon avant la fin de
   * la manche. Les valeurs des indices partaient en clair des le demarrage, avec isRevealed a false.
   */
  describe('anti-triche des indices', () => {
    it('ne transmet aucune valeur d’indice tant que rien n’est révélé', async () => {
      const state = await service.startRound({ generations: [1], level: 'MOYEN' });
      expect(state.hints).toHaveLength(4);
      expect(state.hints.every((h) => h.value === null)).toBe(true);
    });

    it('ne transmet pas les valeurs via la relecture d’une manche', async () => {
      const started = await service.startRound({ generations: [1], level: 'MOYEN' });
      const stored = mockRedisSet.mock.calls[mockRedisSet.mock.calls.length - 1]?.[1] as string;
      mockRedisGet.mockResolvedValue(stored);

      const state = await service.getRoundState(started.roundId);
      expect(state.hints.every((h) => h.value === null)).toBe(true);
    });

    it('ne transmet que la valeur révélée, pas celles des autres paliers', async () => {
      const mockSession = {
        roundId: 'r1',
        sessionHash: 'h1',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now(),
        currentScore: 100,
        mistakesCount: 2,
        hintsUsedCount: 0,
        mode: 'CLASSIC',
        level: 'MOYEN',
        roundIndex: 1,
        totalRounds: 5,
        hints: [
          { type: 'TYPE_1', label: 'Type 1', value: 'Électrik', cost: 0, unlockedAtMistakeCount: 1, isRevealed: false },
          { type: 'HEIGHT', label: 'Taille', value: '0.4 m', cost: 0, unlockedAtMistakeCount: 2, isRevealed: false },
        ],
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(mockSession));

      const state = await service.requestHint('r1', 'TYPE_1');
      expect(state.hints.find((h) => h.type === 'TYPE_1')?.value).toBe('Électrik');
      expect(state.hints.find((h) => h.type === 'HEIGHT')?.value).toBeNull();
    });

    it('cumule le total d’essais côté serveur, sans rien accepter du client', async () => {
      // Regle 4 : le total du classement se construit dans Redis. Le client ne l'envoie plus, il ne
      // peut donc plus se declarer a 0 essai sur la derniere manche.
      const store = new Map<string, string>();
      mockRedisSet.mockImplementation((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      });

      const finalSession = (mistakes: number) => ({
        roundId: 'r-final',
        sessionHash: 'h-final',
        targetPokemonId: 25,
        targetNameFr: 'Pikachu',
        targetNameEn: 'Pikachu',
        status: 'PLAYING',
        startTime: Date.now(),
        currentScore: 100,
        mistakesCount: mistakes,
        hintsUsedCount: 0,
        mode: 'DAILY',
        level: 'FACILE',
        roundIndex: 5,
        totalRounds: 5,
        hints: [],
        guestId: 'g_cumul',
        guestName: 'player_cumul',
      });

      // Une manche precedente a deja coute 4 essais.
      store.set('whoisit_attempts:' + new Date().toISOString().slice(0, 10) + ':FACILE:g:g_cumul', '4');
      mockRedisGet.mockImplementation((k: string) => Promise.resolve(store.get(k) ?? null));
      mockRedisGet.mockImplementationOnce(() => Promise.resolve(JSON.stringify(finalSession(2))));

      await service.submitGuess('r-final', 'Pikachu');

      // 4 essais reportes + (2 erreurs + 1 bonne reponse) = 7, quoi qu'envoie le client.
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ guestId: 'g_cumul' }),
        'WHO_IS_IT',
        'FACILE',
        expect.any(Date),
        expect.objectContaining({ attempts: 7 }),
      );
    });

    it('ne renvoie pas de valeur d’indice après une mauvaise réponse', async () => {
      const started = await service.startRound({ generations: [1], level: 'MOYEN' });
      const stored = mockRedisSet.mock.calls[mockRedisSet.mock.calls.length - 1]?.[1] as string;
      mockRedisGet.mockResolvedValue(stored);

      const res = await service.submitGuess(started.roundId, 'Rattata');
      expect(res.isCorrect).toBe(false);
      expect(res.hints.every((h) => h.value === null)).toBe(true);
    });
  });
});
