import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PokemonService {
  // Cache en memoire des sprites publics (octets), evite de re-telecharger a chaque requete.
  private readonly spriteCache = new Map<string, Buffer>();
  private readonly SPRITE_CACHE_MAX = 1200;

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

  /**
   * Sprite public (non masque) d'un Pokemon, servi par le backend pour respecter la Regle 3
   * (le client n'appelle jamais Tyradex directement). Utilise par les jeux qui montrent les Pokemon.
   */
  async getSprite(pokemonId: number): Promise<{ buffer: Buffer; contentType: string }> {
    const pokemon = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      select: { spriteRegular: true },
    });
    if (!pokemon) {
      throw new NotFoundException('Pokémon introuvable');
    }

    const cached = this.spriteCache.get(pokemon.spriteRegular);
    if (cached) {
      return { buffer: cached, contentType: 'image/png' };
    }

    const response = await axios.get<ArrayBuffer>(pokemon.spriteRegular, {
      responseType: 'arraybuffer',
    });
    const buffer: Buffer = Buffer.from(response.data);
    this.spriteCache.set(pokemon.spriteRegular, buffer);
    if (this.spriteCache.size > this.SPRITE_CACHE_MAX) {
      const oldest = this.spriteCache.keys().next().value;
      if (oldest !== undefined) this.spriteCache.delete(oldest);
    }
    return { buffer, contentType: 'image/png' };
  }
}
