import { Test, TestingModule } from '@nestjs/testing';
import { POKEDEX_CORNERS } from '@pokegames/shared-types';
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

    it('assigne un coin valide, stable d’un appel à l’autre pour un même jeton', async () => {
      prisma.pokedexSpawn.findMany.mockResolvedValue([
        { pokemonId: 3, zone: 'home', sessionHash: 'h3', token: 'tok3', collected: false },
      ]);
      const first = await service.getSpawns('u1');
      const second = await service.getSpawns('u1');
      expect(POKEDEX_CORNERS).toContain(first[0]?.corner);
      expect(second[0]?.corner).toBe(first[0]?.corner);
    });

    it('répartit les apparitions sur les quatre coins', async () => {
      prisma.pokedexSpawn.findMany.mockResolvedValue(
        CATALOG.map((p) => ({
          pokemonId: p.id,
          zone: 'home',
          sessionHash: `h${p.id}`,
          token: `11111111-2222-3333-4444-00000000000${p.id.toString(16)}`,
          collected: false,
        })),
      );
      const res = await service.getSpawns('u1');
      const corners = new Set(res.map((s) => s.corner));
      expect(corners.size).toBe(POKEDEX_CORNERS.length);
    });

    it('invité : chaque apparition porte un coin valide', async () => {
      const res = await service.getSpawns();
      expect(res.length).toBeGreaterThan(0);
      for (const spawn of res) expect(POKEDEX_CORNERS).toContain(spawn.corner);
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

    it('jeton invité : ne démasque pas la session de sprite (partagée par tous les invités)', async () => {
      const spawns = await service.getSpawns();
      await service.collect(spawns[0]!.token);
      expect(reveal).not.toHaveBeenCalled();
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
    const DETAIL_ROW = {
      id: 3,
      pokedexId: 3,
      nameFr: 'P3',
      nameEn: 'P3',
      category: null,
      generation: 1,
      height: 1,
      weight: 1,
      statsHp: 1,
      statsAtk: 1,
      statsDef: 1,
      statsSpeAtk: 1,
      statsSpeDef: 1,
      statsSpeed: 1,
      types: [],
    };

    it('refuse le détail d’un Pokémon non collecté', async () => {
      prisma.userPokedexEntry.findFirst.mockResolvedValue(null);
      await expect(service.getDetail(3, 'u1')).rejects.toThrow();
    });

    it('invité sans jeton : refuse le détail', async () => {
      await expect(service.getDetail(3)).rejects.toThrow();
    });

    it('invité : accepte le jeton signé de l’apparition collectée', async () => {
      const spawns = await service.getSpawns();
      const collected = await service.collect(spawns[0]!.token);
      const pokemonId = collected.pokemon!.id;
      prisma.pokemon.findUnique.mockResolvedValue({ ...DETAIL_ROW, id: pokemonId, pokedexId: pokemonId });

      const detail = await service.getDetail(pokemonId, undefined, spawns[0]!.token);
      expect(detail.id).toBe(pokemonId);
      expect(prisma.userPokedexEntry.findFirst).not.toHaveBeenCalled();
    });

    it('invité : refuse un jeton qui ne correspond pas au Pokémon demandé', async () => {
      const spawns = await service.getSpawns();
      const collected = await service.collect(spawns[0]!.token);
      const otherId = collected.pokemon!.id + 1;
      await expect(service.getDetail(otherId, undefined, spawns[0]!.token)).rejects.toThrow();
    });

    it('invité : refuse un jeton dont la signature est falsifiée', async () => {
      const spawns = await service.getSpawns();
      const parts = spawns[0]!.token.split('.');
      const forged = `${parts[0]}.${parts[1]}.deadbeef`;
      const collected = await service.collect(spawns[0]!.token);
      await expect(
        service.getDetail(collected.pokemon!.id, undefined, forged),
      ).rejects.toThrow();
    });
  });
});
