import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { TyradexEtlService } from './tyradex-etl.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TyradexEtlService', () => {
  let service: TyradexEtlService;
  let mockUpsertPokemon: jest.Mock;
  let mockUpsertType: jest.Mock;
  let mockUpsertPokemonType: jest.Mock;
  let mockFindUniquePokemon: jest.Mock;
  let mockFindFirstEvolution: jest.Mock;
  let mockCreateEvolution: jest.Mock;

  beforeEach(async () => {
    mockUpsertPokemon = jest.fn().mockResolvedValue({ id: 25 });
    mockUpsertType = jest.fn().mockResolvedValue({ id: 1 });
    mockUpsertPokemonType = jest.fn().mockResolvedValue({});
    mockFindUniquePokemon = jest.fn().mockResolvedValue({ id: 26 });
    mockFindFirstEvolution = jest.fn().mockResolvedValue(null);
    mockCreateEvolution = jest.fn().mockResolvedValue({});

    const mockPrismaService = {
      pokemon: { upsert: mockUpsertPokemon, findUnique: mockFindUniquePokemon },
      type: { upsert: mockUpsertType },
      pokemonType: { upsert: mockUpsertPokemonType },
      evolution: { findFirst: mockFindFirstEvolution, create: mockCreateEvolution },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TyradexEtlService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TyradexEtlService>(TyradexEtlService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('doit importer les Pokémon depuis l’API Tyradex vers PostgreSQL en gérant la virgule décimale', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          pokedex_id: 25,
          generation: 1,
          category: 'Souris',
          name: { fr: 'Pikachu', en: 'Pikachu' },
          sprites: { regular: 'https://example.com/25.png', shiny: null },
          types: [{ name: 'Électrik', image: 'https://example.com/elec.png' }],
          stats: { hp: 35, atk: 55, def: 40, spe_atk: 50, spe_def: 50, vit: 90 },
          height: '0,7 m',
          weight: '6,5 kg',
          evolution: {
            next: [{ pokedex_id: 26, name: 'Raichu', condition: 'Pierre Foudre' }],
          },
        },
      ],
    });

    const res = await service.syncPokemons();

    expect(res.importedCount).toBe(1);
    expect(mockUpsertPokemon).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          height: 0.7,
          weight: 6.5,
        }),
      }),
    );
    expect(mockUpsertType).toHaveBeenCalled();
    expect(mockUpsertPokemonType).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ slot: 1 }),
      }),
    );
    expect(mockCreateEvolution).toHaveBeenCalled();
  });
});
