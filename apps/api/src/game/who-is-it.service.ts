import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SpriteProxyService } from './sprite-proxy.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import {
  WhoIsItConfig,
  WhoIsItRoundState,
  WhoIsItGuessResponse,
  WhoIsItHint,
  PokemonDTO,
} from '@pokegames/shared-types';

interface WhoIsItServerSession {
  roundId: string;
  sessionHash: string;
  pokemonId: number;
  pokedexId: number;
  nameFr: string;
  generation: number;
  types: string[];
  startTime: number;
  timeLimitSeconds: number;
  status: 'PLAYING' | 'SOLVED' | 'TIMEOUT';
}

@Injectable()
export class WhoIsItService {
  private readonly ROUND_PREFIX = 'whoisit_round:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly spriteProxyService: SpriteProxyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Normalise une chaîne de caractères pour la comparaison (minuscules, sans accents, sans espaces superflus).
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Calcule les indices débloqués en fonction du temps écoulé depuis le début du round.
   */
  private calculateAvailableHints(session: WhoIsItServerSession, elapsedSeconds: number): WhoIsItHint[] {
    const hints: WhoIsItHint[] = [];

    // Indice 1 à partir de 5 secondes : Génération
    if (elapsedSeconds >= 5) {
      hints.push({
        type: 'GENERATION',
        label: 'Génération',
        value: `Génération ${session.generation}`,
        revealedAtSecond: 5,
      });
    }

    // Indice 2 à partir de 12 secondes : Types
    if (elapsedSeconds >= 12) {
      hints.push({
        type: 'TYPE_1',
        label: 'Type(s)',
        value: session.types.join(' / '),
        revealedAtSecond: 12,
      });
    }

    // Indice 3 à partir de 20 secondes : Première lettre du nom
    if (elapsedSeconds >= 20) {
      const firstChar = session.nameFr.charAt(0).toUpperCase();
      hints.push({
        type: 'FIRST_LETTER',
        label: 'Première lettre',
        value: `${firstChar}...`,
        revealedAtSecond: 20,
      });
    }

    return hints;
  }

  /**
   * Construit le DTO complet du Pokémon pour la fin de partie.
   */
  private async getFullPokemonDTO(pokemonId: number): Promise<PokemonDTO> {
    const p = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      include: {
        types: { include: { type: true } },
        evolutions: { include: { target: true } },
        evolvedFrom: { include: { pokemon: true } },
      },
    });

    if (!p) {
      throw new NotFoundException(`Pokémon ID ${pokemonId} introuvable en base`);
    }

    return {
      id: p.id,
      pokedexId: p.pokedexId,
      nameFr: p.nameFr,
      nameEn: p.nameEn,
      category: p.category,
      generation: p.generation,
      spriteRegular: p.spriteRegular,
      spriteShiny: p.spriteShiny,
      stats: {
        hp: p.statsHp,
        atk: p.statsAtk,
        def: p.statsDef,
        speAtk: p.statsSpeAtk,
        speDef: p.statsSpeDef,
        speed: p.statsSpeed,
      },
      weight: p.weight,
      height: p.height,
      types: p.types.map((pt) => ({
        id: pt.type.id,
        nameFr: pt.type.nameFr,
        nameEn: pt.type.nameEn,
        image: pt.type.image,
      })),
      evolutions: p.evolutions.map((ev) => ({
        pokedexId: ev.target.pokedexId,
        nameFr: ev.target.nameFr,
        condition: ev.condition,
      })),
      evolvedFrom: p.evolvedFrom.map((ev) => ({
        pokedexId: ev.pokemon.pokedexId,
        nameFr: ev.pokemon.nameFr,
        condition: ev.condition,
      })),
    };
  }

  /**
   * Démarre une nouvelle manche de "Quel est ce Pokémon ?" avec masquage strict.
   */
  async startRound(config?: Partial<WhoIsItConfig>): Promise<WhoIsItRoundState> {
    const generations = config?.generations?.length ? config.generations : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const timeLimitSeconds = config?.timeLimitSeconds && config.timeLimitSeconds > 0 ? config.timeLimitSeconds : 30;

    // Sélection aléatoire d'un Pokémon parmi les générations choisies
    const pokemonsCount = await this.prisma.pokemon.count({
      where: { generation: { in: generations } },
    });

    if (pokemonsCount === 0) {
      throw new BadRequestException('Aucun Pokémon disponible pour ces générations en base de données. Veuillez lancer le script ETL.');
    }

    const skip = Math.floor(Math.random() * pokemonsCount);
    const pokemons = await this.prisma.pokemon.findMany({
      where: { generation: { in: generations } },
      include: { types: { include: { type: true } } },
      skip,
      take: 1,
    });

    const selected = pokemons[0];
    if (!selected) {
      throw new NotFoundException('Erreur lors de la sélection du Pokémon');
    }

    const roundId = uuidv4();
    const sessionHash = uuidv4();
    const startTime = Date.now();

    // Enregistrement du proxy d'image anonymisé
    await this.spriteProxyService.registerSpriteSession(
      sessionHash,
      selected.id,
      selected.spriteRegular,
      timeLimitSeconds + 60,
    );

    const serverSession: WhoIsItServerSession = {
      roundId,
      sessionHash,
      pokemonId: selected.id,
      pokedexId: selected.pokedexId,
      nameFr: selected.nameFr,
      generation: selected.generation,
      types: selected.types.map((pt) => pt.type.nameFr),
      startTime,
      timeLimitSeconds,
      status: 'PLAYING',
    };

    await this.redisService.set(
      `${this.ROUND_PREFIX}${roundId}`,
      JSON.stringify(serverSession),
      timeLimitSeconds + 120,
    );

    return {
      roundId,
      sessionHash,
      spriteProxyUrl: `/api/sprites/${sessionHash}`,
      status: 'PLAYING',
      startTime,
      timeLimitSeconds,
      hints: [],
    };
  }

  /**
   * Récupère l'état actuel d'un round et ses indices débloqués sans révéler le secret.
   */
  async getRoundState(roundId: string): Promise<WhoIsItRoundState> {
    const raw = await this.redisService.get(`${this.ROUND_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    let session: WhoIsItServerSession;
    try {
      session = JSON.parse(raw) as WhoIsItServerSession;
    } catch {
      throw new NotFoundException('Session corrompue');
    }

    const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);

    // Vérification du timeout automatique
    if (session.status === 'PLAYING' && elapsedSeconds >= session.timeLimitSeconds) {
      session.status = 'TIMEOUT';
      await this.redisService.set(`${this.ROUND_PREFIX}${roundId}`, JSON.stringify(session), 60);
      await this.spriteProxyService.revealSpriteSession(session.sessionHash);
      const hints = this.calculateAvailableHints(session, elapsedSeconds);
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'WHO_IS_IT',
          session.pokemonId,
          session.nameFr,
          false,
          elapsedSeconds,
          hints.length,
          0,
        ),
      );
    }

    const hints = this.calculateAvailableHints(session, elapsedSeconds);

    return {
      roundId: session.roundId,
      sessionHash: session.sessionHash,
      spriteProxyUrl: `/api/sprites/${session.sessionHash}`,
      status: session.status,
      startTime: session.startTime,
      timeLimitSeconds: session.timeLimitSeconds,
      hints,
    };
  }

  /**
   * Soumet une tentative du joueur et vérifie la victoire côté serveur.
   */
  async submitGuess(roundId: string, guess: string, userId?: string): Promise<WhoIsItGuessResponse> {
    if (!guess || typeof guess !== 'string') {
      throw new BadRequestException('Tentative invalide');
    }

    const raw = await this.redisService.get(`${this.ROUND_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    let session: WhoIsItServerSession;
    try {
      session = JSON.parse(raw) as WhoIsItServerSession;
    } catch {
      throw new NotFoundException('Session corrompue');
    }

    const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);

    // Si le temps est dépassé ou la manche déjà terminée
    if (session.status !== 'PLAYING' || elapsedSeconds > session.timeLimitSeconds) {
      session.status = 'TIMEOUT';
      await this.redisService.set(`${this.ROUND_PREFIX}${roundId}`, JSON.stringify(session), 60);
      await this.spriteProxyService.revealSpriteSession(session.sessionHash);
      const revealedPokemon = await this.getFullPokemonDTO(session.pokemonId);
      const hints = this.calculateAvailableHints(session, elapsedSeconds);
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'WHO_IS_IT',
          session.pokemonId,
          session.nameFr,
          false,
          elapsedSeconds,
          hints.length,
          0,
          guess,
          userId,
        ),
      );

      return {
        success: false,
        isCorrect: false,
        status: 'TIMEOUT',
        message: `Temps écoulé ! C'était ${session.nameFr}.`,
        scoreEarned: 0,
        revealedPokemon,
        unmaskedSpriteUrl: `/api/sprites/${session.sessionHash}`,
      };
    }

    const normalizedGuess = this.normalizeString(guess);
    const normalizedTarget = this.normalizeString(session.nameFr);

    if (normalizedGuess === normalizedTarget) {
      // VICTOIRE !
      session.status = 'SOLVED';
      await this.redisService.set(`${this.ROUND_PREFIX}${roundId}`, JSON.stringify(session), 300);
      await this.spriteProxyService.revealSpriteSession(session.sessionHash);

      // Calcul du score e-sport (1000 points de base - 20 pts par seconde écoulée, min 100)
      const timePenalty = elapsedSeconds * 25;
      const scoreEarned = Math.max(100, 1000 - timePenalty);

      // Enregistrer dans l'historique si un joueur est authentifié
      if (userId) {
        await this.prisma.gameHistory.create({
          data: {
            userId,
            gameType: 'WHO_IS_IT',
            score: scoreEarned,
            isMulti: false,
          },
        }).catch(() => {
          // Gérer gracieusement si le userId est externe/inconnu au test
        });
      }

      const revealedPokemon = await this.getFullPokemonDTO(session.pokemonId);
      const hints = this.calculateAvailableHints(session, elapsedSeconds);
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'WHO_IS_IT',
          session.pokemonId,
          session.nameFr,
          true,
          elapsedSeconds,
          hints.length,
          scoreEarned,
          guess,
          userId,
        ),
      );

      return {
        success: true,
        isCorrect: true,
        status: 'SOLVED',
        message: `Bravo ! C'était bien ${session.nameFr} ! (+${scoreEarned} pts)`,
        scoreEarned,
        revealedPokemon,
        unmaskedSpriteUrl: `/api/sprites/${session.sessionHash}`,
      };
    } else {
      // Tentative incorrecte
      return {
        success: true,
        isCorrect: false,
        status: 'PLAYING',
        message: 'Non, ce n’est pas ce Pokémon ! Réessayez.',
        scoreEarned: 0,
        revealedPokemon: null,
        unmaskedSpriteUrl: null,
      };
    }
  }
}
