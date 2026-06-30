import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PokemonService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des noms francais, triee, pour l'autocompletion cote client.
   * Les noms sont publics : les exposer n'aide pas a identifier la cible masquee d'une manche.
   */
  async getNames(): Promise<string[]> {
    const rows = await this.prisma.pokemon.findMany({
      select: { nameFr: true },
      orderBy: { nameFr: 'asc' },
    });
    return rows.map((row) => row.nameFr);
  }
}
