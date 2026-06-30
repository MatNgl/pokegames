import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface TyradexType {
  name: string;
  image: string;
}

interface TyradexStats {
  hp?: number;
  atk?: number;
  def?: number;
  spe_atk?: number;
  spe_def?: number;
  vit?: number;
}

interface TyradexEvolution {
  pokedex_id: number;
  name: string;
  condition?: string;
}

interface TyradexPokemonResponse {
  pokedex_id: number;
  generation?: number;
  category?: string;
  name?: {
    fr: string;
    en: string;
  };
  sprites?: {
    regular: string;
    shiny?: string | null;
  };
  types?: TyradexType[] | null;
  stats?: TyradexStats | null;
  height?: string | null;
  weight?: string | null;
  evolution?: {
    pre?: TyradexEvolution[] | null;
    next?: TyradexEvolution[] | null;
  } | null;
}

@Injectable()
export class TyradexEtlService {
  private readonly logger = new Logger(TyradexEtlService.name);
  private readonly TYRADEX_URL = 'https://tyradex.vercel.app/api/v1/pokemon';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Synchronise l'ensemble du Pokédex depuis Tyradex vers la base PostgreSQL locale.
   */
  async syncPokemons(): Promise<{ importedCount: number; message: string }> {
    this.logger.log(`Démarrage de la synchronisation ETL depuis ${this.TYRADEX_URL}...`);

    const response = await axios.get<TyradexPokemonResponse[]>(this.TYRADEX_URL);
    const rawPokemons = response.data;

    if (!Array.isArray(rawPokemons)) {
      throw new Error('Format de réponse invalide depuis Tyradex API');
    }

    let count = 0;

    for (const raw of rawPokemons) {
      if (raw.pokedex_id === 0 || !raw.name?.fr || !raw.sprites?.regular) {
        continue;
      }

      const parsedHeight = raw.height
        ? parseFloat(raw.height.replace(/[^0-9.]/g, ''))
        : null;
      const parsedWeight = raw.weight
        ? parseFloat(raw.weight.replace(/[^0-9.]/g, ''))
        : null;

      // Upsert du Pokémon
      const pokemon = await this.prisma.pokemon.upsert({
        where: { pokedexId: raw.pokedex_id },
        update: {
          nameFr: raw.name.fr,
          nameEn: raw.name.en ?? raw.name.fr,
          category: raw.category ?? null,
          generation: raw.generation ?? 1,
          spriteRegular: raw.sprites.regular,
          spriteShiny: raw.sprites.shiny ?? null,
          statsHp: raw.stats?.hp ?? 0,
          statsAtk: raw.stats?.atk ?? 0,
          statsDef: raw.stats?.def ?? 0,
          statsSpeAtk: raw.stats?.spe_atk ?? 0,
          statsSpeDef: raw.stats?.spe_def ?? 0,
          statsSpeed: raw.stats?.vit ?? 0,
          weight: isNaN(Number(parsedWeight)) ? null : parsedWeight,
          height: isNaN(Number(parsedHeight)) ? null : parsedHeight,
        },
        create: {
          id: raw.pokedex_id,
          pokedexId: raw.pokedex_id,
          nameFr: raw.name.fr,
          nameEn: raw.name.en ?? raw.name.fr,
          category: raw.category ?? null,
          generation: raw.generation ?? 1,
          spriteRegular: raw.sprites.regular,
          spriteShiny: raw.sprites.shiny ?? null,
          statsHp: raw.stats?.hp ?? 0,
          statsAtk: raw.stats?.atk ?? 0,
          statsDef: raw.stats?.def ?? 0,
          statsSpeAtk: raw.stats?.spe_atk ?? 0,
          statsSpeDef: raw.stats?.spe_def ?? 0,
          statsSpeed: raw.stats?.vit ?? 0,
          weight: isNaN(Number(parsedWeight)) ? null : parsedWeight,
          height: isNaN(Number(parsedHeight)) ? null : parsedHeight,
        },
      });

      // Gestion des Types
      if (raw.types && Array.isArray(raw.types)) {
        for (const typeInfo of raw.types) {
          const dbType = await this.prisma.type.upsert({
            where: { nameFr: typeInfo.name },
            update: { image: typeInfo.image },
            create: {
              nameFr: typeInfo.name,
              nameEn: typeInfo.name, // Tyradex FR fournit le nom FR
              image: typeInfo.image,
            },
          });

          await this.prisma.pokemonType.upsert({
            where: {
              pokemonId_typeId: {
                pokemonId: pokemon.id,
                typeId: dbType.id,
              },
            },
            update: {},
            create: {
              pokemonId: pokemon.id,
              typeId: dbType.id,
            },
          });
        }
      }

      count++;
    }

    this.logger.log(`Synchronisation ETL terminée : ${count} Pokémon importés.`);
    return {
      importedCount: count,
      message: `Synchronisation réussie : ${count} Pokémon importés dans PostgreSQL.`,
    };
  }
}
