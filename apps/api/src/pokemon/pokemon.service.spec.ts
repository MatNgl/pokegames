import { Test, TestingModule } from '@nestjs/testing';
import { PokemonService } from './pokemon.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PokemonService', () => {
  let service: PokemonService;
  let mockFindMany: jest.Mock;

  beforeEach(async () => {
    mockFindMany = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokemonService,
        { provide: PrismaService, useValue: { pokemon: { findMany: mockFindMany } } },
      ],
    }).compile();

    service = module.get<PokemonService>(PokemonService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('retourne la liste des noms français triés', async () => {
    mockFindMany.mockResolvedValue([{ nameFr: 'Bulbizarre' }, { nameFr: 'Salamèche' }]);

    const names = await service.getNames();

    expect(names).toEqual(['Bulbizarre', 'Salamèche']);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { nameFr: true },
      orderBy: { nameFr: 'asc' },
    });
  });
});
