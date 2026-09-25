import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PokemonService } from './pokemon.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PokemonService', () => {
  let service: PokemonService;
  let mockFindMany: jest.Mock;
  let mockFindUnique: jest.Mock;

  beforeEach(async () => {
    mockFindMany = jest.fn();
    mockFindUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokemonService,
        {
          provide: PrismaService,
          useValue: { pokemon: { findMany: mockFindMany, findUnique: mockFindUnique } },
        },
      ],
    }).compile();

    service = module.get<PokemonService>(PokemonService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('retourne la liste des noms français triés, avec leur id', async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, nameFr: 'Bulbizarre' },
      { id: 4, nameFr: 'Salamèche' },
    ]);

    const names = await service.getNames();

    expect(names).toEqual([
      { id: 1, nameFr: 'Bulbizarre' },
      { id: 4, nameFr: 'Salamèche' },
    ]);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { id: true, nameFr: true },
      orderBy: { nameFr: 'asc' },
    });
  });

  it('renvoie 404 pour le méga-sprite d’un Pokémon sans méga-évolution', async () => {
    mockFindUnique.mockResolvedValue({ megaSpriteRegular: null });

    await expect(service.getMegaSprite(4)).rejects.toBeInstanceOf(NotFoundException);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 4 },
      select: { megaSpriteRegular: true },
    });
  });

  it('renvoie 404 pour le méga-sprite d’un Pokémon inexistant', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(service.getMegaSprite(99999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renvoie 404 pour le sprite shiny d’un Pokémon sans version shiny', async () => {
    mockFindUnique.mockResolvedValue({ spriteShiny: null });

    await expect(service.getShinySprite(129)).rejects.toBeInstanceOf(NotFoundException);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 129 },
      select: { spriteShiny: true },
    });
  });
});
