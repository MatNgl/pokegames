import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import sharp from 'sharp';
import { TrueShinyService } from './true-shiny.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PokemonService } from '../pokemon/pokemon.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

// 3 niveaux x 5 manches = 15 Pokemon distincts requis (dedup inter-niveaux).
const pool = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, nameFr: `Pokemon${i + 1}` }));

// Signature magique d'un fichier PNG.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function fakePng(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe('TrueShinyService', () => {
  let service: TrueShinyService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;
  let mockGetShinySprite: jest.Mock;

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);
    mockGetShinySprite = jest
      .fn()
      .mockResolvedValue({ buffer: await fakePng(), contentType: 'image/png' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrueShinyService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } },
        },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: PokemonService, useValue: { getShinySprite: mockGetShinySprite } },
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

    service = module.get<TrueShinyService>(TrueShinyService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche FACILE avec 3 vignettes opaques, sans révéler la réponse', async () => {
      const state = await service.startDaily('FACILE');

      expect(state.level).toBe('FACILE');
      expect(state.totalRounds).toBe(5);
      expect(state.roundIndex).toBe(1);
      expect(state.status).toBe('PLAYING');
      expect(state.tiles).toHaveLength(3);
      for (const tile of state.tiles) {
        expect(tile.imageUrl).toMatch(/^\/api\/games\/true-shiny\/tile\/[\w-]+\/\d+\/\d+$/);
      }
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('answerSlot');
      expect(serialized).not.toContain('hue');
    });

    it('applique la taille de grille du niveau (DIFFICILE = 6 vignettes)', async () => {
      const state = await service.startDaily('DIFFICILE');
      expect(state.tiles).toHaveLength(6);
    });

    it('rejette un niveau invalide', async () => {
      await expect(service.startDaily('EXTREME' as never)).rejects.toThrow();
    });

    it('varie les Pokémon sur les 5 manches et garde un seul slot intact par manche', async () => {
      await service.startDaily('MOYEN');
      const session = JSON.parse(mockSet.mock.calls[0]?.[1] as string) as {
        rounds: { pokemonId: number; slots: { hue: number }[]; answerSlot: number }[];
      };
      expect(session.rounds).toHaveLength(5);
      expect(new Set(session.rounds.map((r) => r.pokemonId)).size).toBe(5);
      for (const round of session.rounds) {
        const intact = round.slots.filter((s) => s.hue === 0);
        expect(intact).toHaveLength(1);
        expect(round.slots[round.answerSlot]?.hue).toBe(0);
      }
    });
  });

  describe('getTile', () => {
    const tileSession = JSON.stringify({
      roundId: 'r1',
      level: 'FACILE',
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      rounds: [
        {
          pokemonId: 25,
          name: 'Pikachu',
          answerSlot: 1,
          slots: [{ hue: 90 }, { hue: 0 }, { hue: -120 }],
        },
      ],
    });

    it('sert une image PNG valide pour le slot intact (réponse)', async () => {
      mockGet.mockResolvedValue(tileSession);

      const res = await service.getTile('r1', 0, 1);
      expect(mockGetShinySprite).toHaveBeenCalledWith(25);
      expect(res.contentType).toBe('image/png');
      expect(res.buffer.subarray(0, 4)).toEqual(PNG_MAGIC);
    });

    it('sert une image PNG valide (teinte modifiée) pour un slot leurre', async () => {
      mockGet.mockResolvedValue(tileSession);

      const res = await service.getTile('r1', 0, 0);
      expect(res.buffer.subarray(0, 4)).toEqual(PNG_MAGIC);
    });
  });

  describe('submitChoice', () => {
    function session(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        roundId: 'r1',
        level: 'FACILE',
        currentIndex: 0,
        correctCount: 0,
        status: 'PLAYING',
        startTime: Date.now(),
        rounds: [
          { pokemonId: 25, name: 'Pikachu', answerSlot: 1, slots: [{ hue: 90 }, { hue: 0 }, { hue: -120 }] },
          { pokemonId: 6, name: 'Dracaufeu', answerSlot: 0, slots: [{ hue: 0 }, { hue: 70 }, { hue: -80 }] },
        ],
        ...overrides,
      });
    }

    it('valide le bon slot intact, révèle le nom et avance', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitChoice('r1', 1);

      expect(res.correct).toBe(true);
      expect(res.answerSlot).toBe(1);
      expect(res.pokemonName).toBe('Pikachu');
      expect(res.reveals[1]?.isAnswer).toBe(true);
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(1);
    });

    it('marque un mauvais slot sans incrémenter le score', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitChoice('r1', 0);

      expect(res.correct).toBe(false);
      expect(res.state.correctCount).toBe(0);
    });

    it('termine la partie au dernier round et émet l’événement d’audit', async () => {
      mockGet.mockResolvedValue(session({ currentIndex: 1, correctCount: 1 }));

      const res = await service.submitChoice('r1', 0);

      expect(res.state.status).toBe('FINISHED');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });
  });
});
