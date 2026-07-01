import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IntruderLevel } from '@pokegames/shared-types';
import { IntruderService } from './intruder.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HistoryService } from '../history/history.service';
import { DailyResultService } from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import { gameConfigMock } from '../game-config/game-config.mock';

const TYPES = ['Feu', 'Eau', 'Plante', 'Électrik', 'Roche', 'Insecte'];

// Pool synthetique riche : chaque regle (generation, type, stat, evolution, mega) et chaque
// taille de grille (4 a 6) trouve des groupes, avec de quoi couvrir les 3 niveaux sans repetition.
const bigPool = Array.from({ length: 120 }, (_, i) => {
  const typeName = TYPES[i % TYPES.length] ?? 'Feu';
  return {
    id: i + 1,
    pokedexId: i + 1,
    nameFr: `P${i + 1}`,
    generation: (i % 9) + 1,
    statsHp: 30 + (i % 20) * 6,
    statsAtk: 30 + (i % 15) * 6,
    statsDef: 30 + (i % 18) * 5,
    statsSpeAtk: 30 + (i % 12) * 7,
    statsSpeDef: 30 + (i % 14) * 6,
    statsSpeed: 20 + (i % 25) * 5,
    isFinalEvolution: i % 2 === 0,
    hasMega: i % 4 === 0,
    types: [{ slot: 1, type: { nameFr: typeName, image: `https://img/${typeName}.png` } }],
  };
});

interface StoredRound {
  memberIds: number[];
}
interface StoredSession {
  rounds: StoredRound[];
}

describe('IntruderService', () => {
  let service: IntruderService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;

  function lastSaved(): StoredSession {
    return JSON.parse(String(mockSet.mock.calls.at(-1)?.[1])) as StoredSession;
  }

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntruderService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(bigPool) } },
        },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
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

    service = module.get<IntruderService>(IntruderService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('Facile : 5 grilles de 4 membres, indice explicite, intrus caché', async () => {
      const state = await service.startDaily('FACILE');

      expect(state.roundId).toBeDefined();
      expect(state.level).toBe('FACILE');
      expect(state.totalRounds).toBe(5);
      expect(state.roundIndex).toBe(1);
      expect(state.status).toBe('PLAYING');
      expect(state.members).toHaveLength(4);
      expect(state.hint).toBeTruthy();
      for (const m of state.members) {
        expect(m.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
      }
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('intruderId');
      expect(serialized).not.toContain('commonLabel');
    });

    it('adapte la taille de grille au niveau (Moyen 5, Difficile 6)', async () => {
      const moyen = await service.startDaily('MOYEN');
      expect(moyen.members).toHaveLength(5);
      const difficile = await service.startDaily('DIFFICILE');
      expect(difficile.members).toHaveLength(6);
    });

    it('rejette un niveau invalide', async () => {
      await expect(service.startDaily('IMPOSSIBLE' as IntruderLevel)).rejects.toThrow('Niveau invalide');
    });

    it('ne répète aucun Pokémon entre les niveaux d’un même jour', async () => {
      await service.startDaily('FACILE');
      const facile = lastSaved();
      await service.startDaily('DIFFICILE');
      const difficile = lastSaved();

      const facileIds = new Set(facile.rounds.flatMap((r) => r.memberIds));
      const difficileIds = difficile.rounds.flatMap((r) => r.memberIds);
      for (const id of difficileIds) {
        expect(facileIds.has(id)).toBe(false);
      }
    });

    it('est déterministe pour une même journée et un même niveau', async () => {
      const first = await service.startDaily('FACILE');
      const second = await service.startDaily('FACILE');
      expect(second.members.map((m) => m.pokemonId)).toEqual(first.members.map((m) => m.pokemonId));
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
          {
            rule: 'TYPE',
            memberIds: [6, 4, 5, 3],
            names: { 6: 'Dracaufeu', 4: 'Salamèche', 5: 'Reptincel', 3: 'Florizarre' },
            intruderId: 3,
            commonLabel: 'Même type principal : Feu',
            hint: "Trouve celui qui n'est pas de type Feu",
            reveals: [
              { pokemonId: 6, name: 'Dracaufeu', isIntruder: false, detail: 'Feu' },
              { pokemonId: 4, name: 'Salamèche', isIntruder: false, detail: 'Feu' },
              { pokemonId: 5, name: 'Reptincel', isIntruder: false, detail: 'Feu' },
              { pokemonId: 3, name: 'Florizarre', isIntruder: true, detail: 'Eau' },
            ],
          },
          {
            rule: 'GENERATION',
            memberIds: [3, 6, 9, 155],
            names: { 3: 'Florizarre', 6: 'Dracaufeu', 9: 'Tortank', 155: 'Héricendre' },
            intruderId: 155,
            commonLabel: 'Même génération : Génération 1',
            hint: "Trouve celui qui n'est pas de la génération 1",
            reveals: [
              { pokemonId: 3, name: 'Florizarre', isIntruder: false, detail: 'Génération 1' },
              { pokemonId: 6, name: 'Dracaufeu', isIntruder: false, detail: 'Génération 1' },
              { pokemonId: 9, name: 'Tortank', isIntruder: false, detail: 'Génération 1' },
              { pokemonId: 155, name: 'Héricendre', isIntruder: true, detail: 'Génération 2' },
            ],
          },
        ],
        ...overrides,
      });
    }

    it('valide le bon intrus, révèle le trait commun et avance', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitChoice('r1', 3);

      expect(res.correct).toBe(true);
      expect(res.intruderId).toBe(3);
      expect(res.rule).toBe('TYPE');
      expect(res.commonLabel).toBe('Même type principal : Feu');
      expect(res.reveals).toHaveLength(4);
      expect(res.state.roundIndex).toBe(2);
      expect(res.state.correctCount).toBe(1);
      expect(res.state.status).toBe('PLAYING');
    });

    it('marque un mauvais choix sans incrémenter le score', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitChoice('r1', 6);

      expect(res.correct).toBe(false);
      expect(res.intruderId).toBe(3);
      expect(res.state.correctCount).toBe(0);
    });

    it('termine la partie au dernier round et émet l’événement d’audit', async () => {
      mockGet.mockResolvedValue(session({ currentIndex: 1, correctCount: 1 }));

      const res = await service.submitChoice('r1', 155);

      expect(res.state.status).toBe('FINISHED');
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });
  });
});
