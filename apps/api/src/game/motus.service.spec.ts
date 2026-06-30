import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MotusService } from './motus.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('MotusService', () => {
  let service: MotusService;
  let mockFindMany: jest.Mock;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockEmit: jest.Mock;

  const pokemons = [
    { id: 1, nameFr: 'Roucool' },
    { id: 2, nameFr: 'Pikachu' },
    { id: 3, nameFr: 'Carapuce' },
    { id: 4, nameFr: 'Salamèche' },
  ];

  function session(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      roundId: 'r1',
      pokemonId: 1,
      answer: 'ROUCOOL',
      length: 7,
      maxAttempts: 6,
      attempts: [],
      status: 'PLAYING',
      startTime: Date.now(),
      ...overrides,
    });
  }

  beforeEach(async () => {
    mockFindMany = jest.fn().mockResolvedValue(pokemons);
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockEmit = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotusService,
        { provide: PrismaService, useValue: { pokemon: { findMany: mockFindMany } } },
        { provide: RedisService, useValue: { get: mockGet, set: mockSet, del: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: mockEmit } },
      ],
    }).compile();

    service = module.get<MotusService>(MotusService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('startDaily', () => {
    it('renvoie une partie avec 6 essais, sans révéler le mot, longueur entre 5 et 9', async () => {
      const state = await service.startDaily();

      expect(state.roundId).toBeDefined();
      expect(state.maxAttempts).toBe(6);
      expect(state.attempts).toHaveLength(0);
      expect(state.status).toBe('PLAYING');
      expect(state.answer).toBeNull();
      expect(state.length).toBeGreaterThanOrEqual(5);
      expect(state.length).toBeLessThanOrEqual(9);
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('submitGuess', () => {
    it('rejette une proposition qui n’est pas un Pokémon de la bonne longueur (sans consommer d’essai)', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitGuess('r1', 'pipo');

      expect(res.accepted).toBe(false);
      expect(res.state.attempts).toHaveLength(0);
    });

    it('colore correctement les lettres (vert / présent / absent) avec gestion des doublons', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitGuess('r1', 'Pikachu');

      expect(res.accepted).toBe(true);
      expect(res.state.status).toBe('PLAYING');
      const states = res.state.attempts[0]?.letters.map((l) => l.state);
      // ROUCOOL vs PIKACHU : C et U presents, le reste absent.
      expect(states).toEqual([
        'ABSENT',
        'ABSENT',
        'ABSENT',
        'ABSENT',
        'PRESENT',
        'ABSENT',
        'PRESENT',
      ]);
    });

    it('marque la partie gagnée et révèle le mot quand la proposition est exacte', async () => {
      mockGet.mockResolvedValue(session());

      const res = await service.submitGuess('r1', 'Roucool');

      expect(res.accepted).toBe(true);
      expect(res.state.status).toBe('WON');
      expect(res.state.answer).toBe('ROUCOOL');
      expect(res.state.attempts[0]?.letters.every((l) => l.state === 'CORRECT')).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('game.round.completed', expect.anything());
    });

    it('marque la partie perdue après le dernier essai raté', async () => {
      mockGet.mockResolvedValue(session({ attempts: new Array(5).fill({ guess: 'PIKACHU', letters: [] }) }));

      const res = await service.submitGuess('r1', 'Pikachu');

      expect(res.accepted).toBe(true);
      expect(res.state.status).toBe('LOST');
      expect(res.state.answer).toBe('ROUCOOL');
    });
  });
});
