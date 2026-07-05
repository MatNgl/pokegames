import { Test, TestingModule } from '@nestjs/testing';
import { PokedexService } from './pokedex.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpriteProxyService } from '../game/sprite-proxy.service';

const CATALOG = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  pokedexId: i + 1,
  nameFr: `P${i + 1}`,
  generation: 1,
  spriteRegular: `s${i + 1}.png`,
}));

describe('PokedexService', () => {
  let service: PokedexService;
  let prisma: {
    pokemon: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
    pokedexSpawn: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
    };
    userPokedexEntry: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let register: jest.Mock;
  let reveal: jest.Mock;

  beforeEach(async () => {
    prisma = {
      pokemon: {
        findMany: jest.fn().mockResolvedValue(CATALOG),
        count: jest.fn().mockResolvedValue(15),
        findUnique: jest.fn(),
      },
      pokedexSpawn: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        update: jest.fn().mockResolvedValue({}),
      },
      userPokedexEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    register = jest.fn().mockResolvedValue(undefined);
    reveal = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokedexService,
        { provide: PrismaService, useValue: prisma },
        { provide: SpriteProxyService, useValue: { registerSpriteSession: register, revealSpriteSession: reveal } },
      ],
    }).compile();

    service = module.get<PokedexService>(PokedexService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  describe('getCollection', () => {
    it('renvoie total, collectés et non-consultés (pastille)', async () => {
      prisma.userPokedexEntry.findMany.mockResolvedValue([
        { pokemonId: 1, seen: true },
        { pokemonId: 2, seen: false },
      ]);
      const res = await service.getCollection('u1');
      expect(res.total).toBe(15);
      expect(res.collectedCount).toBe(2);
      expect(res.newCount).toBe(1);
      expect(res.collectedIds).toEqual([1, 2]);
    });
  });

  describe('getSpawns', () => {
    it('connecté : génère les apparitions du jour si absentes et renvoie les silhouettes masquées', async () => {
      prisma.pokedexSpawn.count.mockResolvedValue(0);
      prisma.pokedexSpawn.findMany.mockResolvedValue([
        { pokemonId: 3, zone: 'home', sessionHash: 'h3', token: 'tok3', collected: false },
      ]);
      const res = await service.getSpawns('u1');
      expect(prisma.pokedexSpawn.createMany).toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0]?.spriteProxyUrl).toBe('/api/sprites/h3');
      expect(res[0]?.token).toBe('tok3');
      expect(register).toHaveBeenCalled();
    });

    it('exclut les Pokémon déjà possédés du tirage', async () => {
      prisma.userPokedexEntry.findMany.mockResolvedValue(CATALOG.map((p) => ({ pokemonId: p.id })));
      await service.getSpawns('u1');
      // Tous possédés : aucune apparition créée.
      const created = prisma.pokedexSpawn.createMany.mock.calls[0]?.[0]?.data ?? [];
      expect(created).toHaveLength(0);
    });
  });

  describe('collect', () => {
    it('jeton connecté : marque collecté et crée l’entrée du Pokédex', async () => {
      prisma.pokedexSpawn.findUnique.mockResolvedValue({
        id: 'sp1',
        userId: 'u1',
        pokemonId: 3,
        sessionHash: 'h3',
        token: 'tok3',
        collected: false,
      });
      const res = await service.collect('tok3', 'u1');
      expect(res.collected).toBe(true);
      expect(res.requiresLogin).toBe(false);
      expect(res.pokemon?.id).toBe(3);
      expect(prisma.pokedexSpawn.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sp1' } }),
      );
      expect(prisma.userPokedexEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', pokemonId: 3 }) }),
      );
      expect(reveal).toHaveBeenCalledWith('h3');
    });

    it('jeton invité : révèle le Pokémon sans l’enregistrer et invite à se connecter', async () => {
      const spawns = await service.getSpawns(); // invité
      const token = spawns[0]!.token;
      const res = await service.collect(token);
      expect(res.pokemon).not.toBeNull();
      expect(res.requiresLogin).toBe(true);
      expect(res.collected).toBe(false);
      expect(prisma.userPokedexEntry.create).not.toHaveBeenCalled();
    });

    it('jeton inconnu : rien à collecter', async () => {
      prisma.pokedexSpawn.findUnique.mockResolvedValue(null);
      const res = await service.collect('inconnu', 'u1');
      expect(res.collected).toBe(false);
      expect(res.pokemon).toBeNull();
    });
  });

  describe('markSeen', () => {
    it('marque toutes les entrées non vues comme consultées', async () => {
      await service.markSeen('u1');
      expect(prisma.userPokedexEntry.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', seen: false },
        data: { seen: true },
      });
    });
  });

  describe('getDetail', () => {
    it('refuse le détail d’un Pokémon non collecté', async () => {
      prisma.userPokedexEntry.findFirst.mockResolvedValue(null);
      await expect(service.getDetail(3, 'u1')).rejects.toThrow();
    });
  });
});
