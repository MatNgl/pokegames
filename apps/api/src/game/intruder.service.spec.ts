import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntruderService } from './intruder.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface RawPokemon {
  id: number;
  pokedexId: number;
  nameFr: string;
  generation: number;
  statsHp: number;
  statsAtk: number;
  statsDef: number;
  statsSpeAtk: number;
  statsSpeDef: number;
  statsSpeed: number;
  isFinalEvolution: boolean;
  hasMega: boolean;
  types: { slot: number; type: { nameFr: string; image: string } }[];
}

type SlotType = { slot: number; type: { nameFr: string; image: string } }[];

function feu(): SlotType {
  return [{ slot: 1, type: { nameFr: 'Feu', image: 'https://img/feu.png' } }];
}

function eau(): SlotType {
  return [{ slot: 1, type: { nameFr: 'Eau', image: 'https://img/eau.png' } }];
}

// Pool volontairement varie pour couvrir toutes les regles (generation, type, stat, evolution, mega).
const pool: RawPokemon[] = [
  { id: 3, pokedexId: 3, nameFr: 'Florizarre', generation: 1, statsHp: 80, statsAtk: 82, statsDef: 83, statsSpeAtk: 100, statsSpeDef: 100, statsSpeed: 80, isFinalEvolution: true, hasMega: true, types: eau() },
  { id: 6, pokedexId: 6, nameFr: 'Dracaufeu', generation: 1, statsHp: 78, statsAtk: 84, statsDef: 78, statsSpeAtk: 109, statsSpeDef: 85, statsSpeed: 100, isFinalEvolution: true, hasMega: true, types: feu() },
  { id: 9, pokedexId: 9, nameFr: 'Tortank', generation: 1, statsHp: 79, statsAtk: 83, statsDef: 100, statsSpeAtk: 85, statsSpeDef: 105, statsSpeed: 78, isFinalEvolution: true, hasMega: true, types: eau() },
  { id: 65, pokedexId: 65, nameFr: 'Alakazam', generation: 1, statsHp: 55, statsAtk: 50, statsDef: 45, statsSpeAtk: 135, statsSpeDef: 95, statsSpeed: 120, isFinalEvolution: true, hasMega: true, types: feu() },
  { id: 4, pokedexId: 4, nameFr: 'Salamèche', generation: 1, statsHp: 39, statsAtk: 52, statsDef: 43, statsSpeAtk: 60, statsSpeDef: 50, statsSpeed: 65, isFinalEvolution: false, hasMega: false, types: feu() },
  { id: 5, pokedexId: 5, nameFr: 'Reptincel', generation: 1, statsHp: 58, statsAtk: 64, statsDef: 58, statsSpeAtk: 80, statsSpeDef: 65, statsSpeed: 80, isFinalEvolution: false, hasMega: false, types: feu() },
  { id: 155, pokedexId: 155, nameFr: 'Héricendre', generation: 2, statsHp: 39, statsAtk: 52, statsDef: 43, statsSpeAtk: 60, statsSpeDef: 50, statsSpeed: 65, isFinalEvolution: false, hasMega: false, types: feu() },
  { id: 158, pokedexId: 158, nameFr: 'Kaiminus', generation: 2, statsHp: 50, statsAtk: 65, statsDef: 64, statsSpeAtk: 44, statsSpeDef: 48, statsSpeed: 43, isFinalEvolution: false, hasMega: false, types: eau() },
  { id: 252, pokedexId: 252, nameFr: 'Arcko', generation: 3, statsHp: 40, statsAtk: 45, statsDef: 35, statsSpeAtk: 65, statsSpeDef: 55, statsSpeed: 70, isFinalEvolution: false, hasMega: false, types: eau() },
  { id: 254, pokedexId: 254, nameFr: 'Jungko', generation: 3, statsHp: 70, statsAtk: 85, statsDef: 65, statsSpeAtk: 105, statsSpeDef: 85, statsSpeed: 120, isFinalEvolution: true, hasMega: true, types: eau() },
];

describe('IntruderService', () => {
  let service: IntruderService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntruderService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: jest.fn().mockResolvedValue(pool) } },
        },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
      ],
    }).compile();

    service = module.get<IntruderService>(IntruderService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie la 1re manche avec 4 membres et sans révéler l’intrus', async () => {
      const state = await service.startDaily();

      expect(state.roundId).toBeDefined();
      expect(state.totalRounds).toBe(10);
      expect(state.roundIndex).toBe(1);
      expect(state.correctCount).toBe(0);
      expect(state.status).toBe('PLAYING');
      expect(state.members).toHaveLength(4);
      for (const m of state.members) {
        expect(m.spriteUrl).toMatch(/^\/api\/pokemon\/\d+\/sprite$/);
        expect(m.name.length).toBeGreaterThan(0);
      }
      // La reponse publique ne doit contenir ni l'intrus ni la regle.
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain('intruder');
      expect(serialized).not.toContain('commonLabel');
    });

    it('est déterministe pour une même journée', async () => {
      const first = await service.startDaily();
      const second = await service.startDaily();
      expect(second.members.map((m) => m.pokemonId)).toEqual(first.members.map((m) => m.pokemonId));
    });
  });

  describe('submitChoice', () => {
    function session(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        roundId: 'r1',
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
            reveals: [
              { pokemonId: 6, name: 'Dracaufeu', isIntruder: false, detail: 'Feu', typeImage: 'https://img/feu.png' },
              { pokemonId: 4, name: 'Salamèche', isIntruder: false, detail: 'Feu', typeImage: 'https://img/feu.png' },
              { pokemonId: 5, name: 'Reptincel', isIntruder: false, detail: 'Feu', typeImage: 'https://img/feu.png' },
              { pokemonId: 3, name: 'Florizarre', isIntruder: true, detail: 'Eau', typeImage: 'https://img/eau.png' },
            ],
          },
          {
            rule: 'GENERATION',
            memberIds: [3, 6, 9, 155],
            names: { 3: 'Florizarre', 6: 'Dracaufeu', 9: 'Tortank', 155: 'Héricendre' },
            intruderId: 155,
            commonLabel: 'Même génération : Génération 1',
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
