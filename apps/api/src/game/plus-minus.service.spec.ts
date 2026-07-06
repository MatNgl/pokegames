import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PlusMinusCriterion, PlusMinusLevel } from '@pokegames/shared-types';
import { PlusMinusService } from './plus-minus.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

interface StoredDuelSide {
  id: number;
  name: string;
  value: number;
}
interface StoredDuel {
  criterion: PlusMinusCriterion;
  a: StoredDuelSide;
  b: StoredDuelSide;
  correct: 'A' | 'B';
}
interface StoredSession {
  level: PlusMinusLevel;
  duels: StoredDuel[];
}

// Pool synthetique large et etale : chaque bande de niveau (ecart large a tres serre) trouve des couples.
// Assez grand pour les 4 niveaux du jour sans repetition (4 x 10 duels x 2 = 80 Pokemon minimum).
const bigPool = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  pokedexId: i + 1,
  nameFr: `P${i + 1}`,
  statsHp: 30 + i * 3,
  statsAtk: 30 + i * 3,
  statsDef: 30 + i * 3,
  statsSpeed: 30 + i * 3,
  height: 0.3 + i * 0.15,
  weight: 5 + i * 4,
}));

function scale(criterion: PlusMinusCriterion): number {
  return criterion === 'HEIGHT' ? 100 : 1;
}

describe('PlusMinusService', () => {
  let service: PlusMinusService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;
  let mockRecentIds: jest.Mock;
  let mockRecordPicks: jest.Mock;

  function duelSession(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      roundId: 'r1',
      level: 'FACILE',
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

  function lastSavedSession(): StoredSession {
    const call = mockSet.mock.calls.at(-1);
    return JSON.parse(String(call?.[1])) as StoredSession;
  }

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);
    mockRecentIds = jest.fn().mockResolvedValue(new Set<number>());
    mockRecordPicks = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlusMinusService,
        { provide: PrismaService, useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(bigPool) } } },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
        {
          provide: HistoryService,
          useValue: {
            recentPokemonIds: mockRecentIds,
            hasPicksFor: jest.fn().mockResolvedValue(false),
            recordPicks: mockRecordPicks,
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

    service = module.get<PlusMinusService>(PlusMinusService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche du niveau sans exposer les valeurs', async () => {
      const state = await service.startDaily('FACILE');

      expect(state.roundId).toBeDefined();
      expect(state.level).toBe('FACILE');
      expect(state.totalRounds).toBe(10);
      expect(state.roundIndex).toBe(1);
      expect(state.status).toBe('PLAYING');
      expect(state.criterionLabel.length).toBeGreaterThan(0);
      expect(state.a.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
      expect('value' in state.a).toBe(false);
    });

    it('enregistre l’identité invité dans la session (guestId + guestName, sans userId)', async () => {
      await service.startDaily('FACILE', { guestId: 'g_abcd', guestName: 'player_abcd' });
      const session = JSON.parse(mockSet.mock.calls[mockSet.mock.calls.length - 1]?.[1] as string) as {
        userId?: string;
        guestId?: string;
        guestName?: string;
      };
      expect(session.userId).toBeUndefined();
      expect(session.guestId).toBe('g_abcd');
      expect(session.guestName).toBe('player_abcd');
    });

    it('rejette un niveau invalide', async () => {
      await expect(service.startDaily('IMPOSSIBLE' as PlusMinusLevel)).rejects.toThrow('Niveau invalide');
    });

    it('respecte la bande d’écart du niveau (Extrême : valeurs proches)', async () => {
      await service.startDaily('EXTREME');
      const session = lastSavedSession();
      expect(session.duels.length).toBeGreaterThan(0);
      for (const duel of session.duels) {
        const diff = Math.abs(duel.a.value - duel.b.value) * scale(duel.criterion);
        if (duel.criterion === 'AGE') {
          // L'anciennete a son propre seuil (Extreme : au moins 50 d'ecart de Pokedex).
          expect(diff).toBeGreaterThanOrEqual(50);
        } else {
          expect(diff).toBeGreaterThanOrEqual(1);
          expect(diff).toBeLessThanOrEqual(9);
        }
      }
    });

    it('exclut les Pokémon tirés les jours précédents et enregistre le tirage du jour', async () => {
      const excluded = new Set<number>(Array.from({ length: 60 }, (_, i) => i + 1));
      mockRecentIds.mockResolvedValue(excluded);

      await service.startDaily('FACILE');
      const session = lastSavedSession();

      for (const duel of session.duels) {
        expect(excluded.has(duel.a.id)).toBe(false);
        expect(excluded.has(duel.b.id)).toBe(false);
      }
      expect(mockRecordPicks).toHaveBeenCalledTimes(1);
    });

    it('ne répète aucun Pokémon entre les niveaux d’un même jour', async () => {
      await service.startDaily('FACILE');
      const facile = lastSavedSession();
      await service.startDaily('EXTREME');
      const extreme = lastSavedSession();

      const facileIds = new Set(facile.duels.flatMap((d) => [d.a.id, d.b.id]));
      const extremeIds = extreme.duels.flatMap((d) => [d.a.id, d.b.id]);
      for (const id of extremeIds) {
        expect(facileIds.has(id)).toBe(false);
      }
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
