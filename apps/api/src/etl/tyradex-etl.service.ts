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

    // Passe 1 : Création / Maj des Pokémon et de leurs types
    for (const raw of rawPokemons) {
      if (raw.pokedex_id === 0 || !raw.name?.fr || !raw.sprites?.regular) {
        continue;
      }

      // Correction parsing décimal (ex: "0,7 m" -> "0.7" -> 0.7)
      const parsedHeight = raw.height
        ? parseFloat(raw.height.replace(/,/g, '.').replace(/[^0-9.]/g, ''))
        : null;
      const parsedWeight = raw.weight
        ? parseFloat(raw.weight.replace(/,/g, '.').replace(/[^0-9.]/g, ''))
        : null;

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

      // Gestion des Types avec Slot (1 pour Type primaire, 2 pour Type secondaire)
      if (raw.types && Array.isArray(raw.types)) {
        for (let idx = 0; idx < raw.types.length; idx++) {
          const typeInfo = raw.types[idx];
          if (!typeInfo) continue;

          const dbType = await this.prisma.type.upsert({
            where: { nameFr: typeInfo.name },
            update: { image: typeInfo.image },
            create: {
              nameFr: typeInfo.name,
              nameEn: typeInfo.name,
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
            update: { slot: idx + 1 },
            create: {
              pokemonId: pokemon.id,
              typeId: dbType.id,
              slot: idx + 1,
            },
          });
        }
      }

      count++;
    }

    // Passe 2 : Synchronisation des Évolutions
    for (const raw of rawPokemons) {
      if (raw.pokedex_id === 0 || !raw.evolution?.next || !Array.isArray(raw.evolution.next)) {
        continue;
      }

      for (const ev of raw.evolution.next) {
        if (ev.pokedex_id === 0) continue;
        const targetExists = await this.prisma.pokemon.findUnique({ where: { id: ev.pokedex_id } });
        if (targetExists) {
          const existingEv = await this.prisma.evolution.findFirst({
            where: { pokemonId: raw.pokedex_id, targetId: ev.pokedex_id },
          });
          if (!existingEv) {
            await this.prisma.evolution.create({
              data: {
                pokemonId: raw.pokedex_id,
                targetId: ev.pokedex_id,
                condition: ev.condition ?? null,
              },
            });
          }
        }
      }
    }

    this.logger.log(`Synchronisation ETL terminée : ${count} Pokémon importés.`);
    return {
      importedCount: count,
      message: `Synchronisation réussie : ${count} Pokémon importés dans PostgreSQL.`,
    };
  }
}
