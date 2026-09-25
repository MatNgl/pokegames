import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import type { PokemonNameOption } from '@pokegames/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PokemonService {
  // Cache en memoire des sprites publics (octets), evite de re-telecharger a chaque requete.
  private readonly spriteCache = new Map<string, Buffer>();
  private readonly SPRITE_CACHE_MAX = 1200;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des noms francais (avec id, pour la vignette de sprite), triee, pour l'autocompletion
   * cote client. Ces donnees sont publiques : les exposer n'aide pas a identifier la cible
   * masquee d'une manche.
   */
  async getNames(): Promise<PokemonNameOption[]> {
    const rows = await this.prisma.pokemon.findMany({
      select: { id: true, nameFr: true },
      orderBy: { nameFr: 'asc' },
    });
    return rows;
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

    return this.fetchSprite(pokemon.spriteRegular);
  }

  /**
   * Sprite de la mega-evolution, servi par le backend (Regle 3). Utilise par la revelation de
   * la regle MEGA du jeu de l'Intrus. 404 si le Pokemon n'a pas de mega-evolution.
   */
  async getMegaSprite(pokemonId: number): Promise<{ buffer: Buffer; contentType: string }> {
    const pokemon = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      select: { megaSpriteRegular: true },
    });
    if (!pokemon?.megaSpriteRegular) {
      throw new NotFoundException('Méga-évolution introuvable');
    }
    return this.fetchSprite(pokemon.megaSpriteRegular);
  }

  /**
   * Sprite chromatique (shiny) d'un Pokemon, servi par le backend (Regle 3). Utilise par le jeu
   * Trouve le shiny. 404 si le Pokemon n'a pas de version shiny (evite d'afficher un sprite normal
   * comme s'il etait shiny).
   */
  async getShinySprite(pokemonId: number): Promise<{ buffer: Buffer; contentType: string }> {
    const pokemon = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      select: { spriteShiny: true },
    });
    if (!pokemon?.spriteShiny) {
      throw new NotFoundException('Sprite shiny introuvable');
    }
    return this.fetchSprite(pokemon.spriteShiny);
  }

  private async fetchSprite(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const cached = this.spriteCache.get(url);
    if (cached) {
      return { buffer: cached, contentType: 'image/png' };
    }

    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const buffer: Buffer = Buffer.from(response.data);
    this.spriteCache.set(url, buffer);
    if (this.spriteCache.size > this.SPRITE_CACHE_MAX) {
      const oldest = this.spriteCache.keys().next().value;
      if (oldest !== undefined) this.spriteCache.delete(oldest);
    }
    return { buffer, contentType: 'image/png' };
  }
}
