import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ShinyService } from './shiny.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PokemonService } from '../pokemon/pokemon.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';
import type { ShinyMode } from '@pokegames/shared-types';

// Assez grand pour les 3 niveaux d'un mode sans repetition (5*3 + 5*4 + 5*6 = 65 Pokemon).
const pool = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  nameFr: `Pokemon${i + 1}`,
}));

interface StoredSlot {
  pokemonId: number;
}
interface StoredRound {
  slots: StoredSlot[];
}
interface StoredSession {
  rounds: StoredRound[];
}

describe('ShinyService', () => {
  let service: ShinyService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;
  let mockGetSprite: jest.Mock;
  let mockGetShinySprite: jest.Mock;

  function lastSaved(): StoredSession {
    return JSON.parse(String(mockSet.mock.calls.at(-1)?.[1])) as StoredSession;
  }

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);
    mockGetSprite = jest.fn();
    mockGetShinySprite = jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.from('x'), contentType: 'image/png' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShinyService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } },
        },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        {
          provide: PokemonService,
          useValue: { getSprite: mockGetSprite, getShinySprite: mockGetShinySprite },
        },
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

    service = module.get<ShinyService>(ShinyService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche (5 manches, 3 vignettes en Facile), sans révéler la réponse', async () => {
      const state = await service.startDaily('FIND_SHINY', 'FACILE');

      expect(state.roundId).toBeDefined();
      expect(state.mode).toBe('FIND_SHINY');
      expect(state.level).toBe('FACILE');
      expect(state.totalRounds).toBe(5);
      expect(state.roundIndex).toBe(1);
      expect(state.status).toBe('PLAYING');
      expect(state.tiles).toHaveLength(3);
      for (const tile of state.tiles) {
        expect(tile.imageUrl).toMatch(/^\/api\/games\/shiny\/tile\/[\w-]+\/\d+\/\d+$/);
      }
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('answerSlot');
      expect(serialized).not.toContain('isShiny');
    });

    it('enregistre l’identité invité dans la session (guestId + guestName, sans userId)', async () => {
      await service.startDaily('FIND_SHINY', 'FACILE', { guestId: 'g_abcd', guestName: 'player_abcd' });
      const session = JSON.parse(mockSet.mock.calls[mockSet.mock.calls.length - 1]?.[1] as string) as {
        userId?: string;
        guestId?: string;
        guestName?: string;
      };
      expect(session.userId).toBeUndefined();
      expect(session.guestId).toBe('g_abcd');
      expect(session.guestName).toBe('player_abcd');
    });

    it('adapte le nombre de vignettes au niveau (Moyen 4, Difficile 6)', async () => {
      const moyen = await service.startDaily('FIND_SHINY', 'MOYEN');
      expect(moyen.tiles).toHaveLength(4);
      const difficile = await service.startDaily('FIND_SHINY', 'DIFFICILE');
      expect(difficile.tiles).toHaveLength(6);
    });

    it('rejette un niveau invalide', async () => {
      await expect(
        service.startDaily('FIND_SHINY', 'IMPOSSIBLE' as 'FACILE'),
      ).rejects.toThrow('Niveau invalide');
    });

    it('ne répète aucun Pokémon entre les niveaux d’un même mode', async () => {
      await service.startDaily('FIND_SHINY', 'FACILE');
      const facile = lastSaved();
      await service.startDaily('FIND_SHINY', 'DIFFICILE');
      const difficile = lastSaved();

      const facileIds = new Set(facile.rounds.flatMap((r) => r.slots.map((s) => s.pokemonId)));
      const difficileIds = difficile.rounds.flatMap((r) => r.slots.map((s) => s.pokemonId));
      for (const id of difficileIds) {
        expect(facileIds.has(id)).toBe(false);
      }
    });

    it('génère un contenu différent entre les deux modes', async () => {
      const shiny = await service.startDaily('FIND_SHINY', 'FACILE');
      const shinyBody = mockSet.mock.calls.at(-1)?.[1] as string;
      const nonShiny = await service.startDaily('FIND_NON_SHINY', 'FACILE');
      const nonShinyBody = mockSet.mock.calls.at(-1)?.[1] as string;
      expect(shiny.mode).toBe('FIND_SHINY');
      expect(nonShiny.mode).toBe('FIND_NON_SHINY');
      expect(shinyBody).not.toBe(nonShinyBody);
    });

    it('est déterministe pour une même journée, un même mode et un même niveau', async () => {
      await service.startDaily('FIND_SHINY', 'FACILE');
      const first = lastSaved();
      await service.startDaily('FIND_SHINY', 'FACILE');
      const second = lastSaved();
      expect(second.rounds).toEqual(first.rounds);
    });
  });

  describe('submitChoice', () => {
    function session(mode: ShinyMode, overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        roundId: 'r1',
        mode,
        level: 'FACILE',
        currentIndex: 0,
        correctCount: 0,
        status: 'PLAYING',
        startTime: Date.now(),
        rounds: [
          {
            slots: [
              { pokemonId: 1, name: 'Pokemon1', shiny: false },
              { pokemonId: 2, name: 'Pokemon2', shiny: true },
              { pokemonId: 3, name: 'Pokemon3', shiny: false },
            ],
            answerSlot: 1,
          },
          {
            slots: [
              { pokemonId: 4, name: 'Pokemon4', shiny: true },
              { pokemonId: 5, name: 'Pokemon5', shiny: false },
              { pokemonId: 6, name: 'Pokemon6', shiny: true },
            ],
            answerSlot: 1,
          },
        ],
        ...overrides,
      });
    }

    it('valide le bon slot, révèle les vignettes et avance', async () => {
      mockGet.mockResolvedValue(session('FIND_SHINY'));

      const res = await service.submitChoice('r1', 1);

      expect(res.correct).toBe(true);
      expect(res.answerSlot).toBe(1);
      expect(res.reveals).toHaveLength(3);
      expect(res.reveals[1]?.isShiny).toBe(true);
      expect(res.reveals[1]?.isAnswer).toBe(true);
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(1);
      expect(res.state.status).toBe('PLAYING');
    });

    it('marque un mauvais slot sans incrémenter le score', async () => {
      mockGet.mockResolvedValue(session('FIND_SHINY'));

      const res = await service.submitChoice('r1', 0);

      expect(res.correct).toBe(false);
      expect(res.answerSlot).toBe(1);
      expect(res.state.correctCount).toBe(0);
    });

    it('termine la partie au dernier round et émet l’événement d’audit', async () => {
      mockGet.mockResolvedValue(session('FIND_NON_SHINY', { currentIndex: 1, correctCount: 1 }));

      const res = await service.submitChoice('r1', 1);

      expect(res.state.status).toBe('FINISHED');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });
  });

  describe('getTile', () => {
    const tileSession = JSON.stringify({
      roundId: 'r1',
      mode: 'FIND_SHINY',
      level: 'FACILE',
      currentIndex: 0,
      correctCount: 0,
      status: 'PLAYING',
      startTime: Date.now(),
      rounds: [
        {
          slots: [
            { pokemonId: 1, name: 'Pokemon1', shiny: false },
            { pokemonId: 2, name: 'Pokemon2', shiny: true },
            { pokemonId: 3, name: 'Pokemon3', shiny: false },
          ],
          answerSlot: 1,
        },
      ],
    });

    it('sert le sprite shiny pour une vignette shiny', async () => {
      mockGet.mockResolvedValue(tileSession);

      await service.getTile('r1', 0, 1);
      expect(mockGetShinySprite).toHaveBeenCalledWith(2);
      expect(mockGetSprite).not.toHaveBeenCalled();
    });

    it('sert le sprite normal pour une vignette non shiny', async () => {
      mockGetSprite.mockResolvedValue({ buffer: Buffer.from('y'), contentType: 'image/png' });
      mockGet.mockResolvedValue(tileSession);

      await service.getTile('r1', 0, 0);
      expect(mockGetSprite).toHaveBeenCalledWith(1);
    });
  });
});
