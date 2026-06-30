import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SpriteProxyService } from './sprite-proxy.service';
import { RedisService } from '../redis/redis.service';
import {
  WhoIsItConfig,
  WhoIsItRoundState,
  WhoIsItGuessResponse,
  WhoIsItHint,
  WhoIsItHintType,
  PokemonDTO,
  WhoIsItMode,
} from '@pokegames/shared-types';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';

interface InternalRoundSession {
  roundId: string;
  sessionHash: string;
  targetPokemonId: number;
  targetNameFr: string;
  targetNameEn: string;
  status: 'PLAYING' | 'SOLVED' | 'CANCELLED';
  startTime: number;
  currentScore: number;
  mistakesCount: number;
  hintsUsedCount: number;
  mode: WhoIsItMode;
  roundIndex: number;
  totalRounds: number;
  hints: WhoIsItHint[];
  userId?: string;
}

@Injectable()
export class WhoIsItService {
  private readonly REDIS_PREFIX = 'game_whoisit:';
  private readonly ROUND_TTL_SECONDS = 3600; // 1 heure de validité session max

  constructor(
    private readonly prisma: PrismaService,
    private readonly spriteProxy: SpriteProxyService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Démarre une nouvelle manche avec capital 100 points, pas d'échec au temps et indices payants.
   */
  async startRound(config: WhoIsItConfig = { generations: [] }, userId?: string, roundIndex = 1): Promise<WhoIsItRoundState> {
    const mode = config.mode ?? 'CLASSIC';
    const totalRounds = config.roundsCount ?? 5;
    const startCapital = config.startCapital ?? 100;

    const whereClause: { generation?: { in: number[] } } = {};
    if (config.generations && config.generations.length > 0) {
      whereClause.generation = { in: config.generations };
    }

    const pokemons = await this.prisma.pokemon.findMany({
      where: whereClause,
      include: {
        types: {
          include: { type: true },
          orderBy: { slot: 'asc' },
        },
      },
    });

    if (pokemons.length === 0) {
      throw new NotFoundException('Aucun Pokémon trouvé pour les générations spécifiées');
    }

    let targetIndex: number;
    if (mode === 'DAILY') {
      // Graine déterministe par date et index de round pour le défi du jour
      const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
      let seed = 0;
      for (let i = 0; i < todayStr.length; i++) {
        seed = (seed * 31 + todayStr.charCodeAt(i) + roundIndex * 17) % pokemons.length;
      }
      targetIndex = Math.abs(seed) % pokemons.length;
    } else {
      targetIndex = Math.floor(Math.random() * pokemons.length);
    }

    const target = pokemons[targetIndex];
    if (!target) {
      throw new NotFoundException('Pokémon cible introuvable');
    }

    const roundId = uuidv4();
    const sessionHash = uuidv4().replace(/-/g, '').substring(0, 16);

    await this.spriteProxy.registerSpriteSession(
      sessionHash,
      target.id,
      target.spriteRegular,
      this.ROUND_TTL_SECONDS,
    );

    const type1 = target.types.find((t) => t.slot === 1)?.type.nameFr ?? target.types[0]?.type.nameFr ?? 'Inconnu';
    const type2 = target.types.find((t) => t.slot === 2)?.type.nameFr ?? target.types[1]?.type.nameFr ?? 'Aucun';
    const hintCost = config.hintCost ?? 10;

    // Échelle d'indices à ordre fixe, débloquée par palier d'erreur, révélée au choix du joueur (payante).
    // Ordre : couleur floutée, type 1, type 2, génération, puis première lettre (l'indice le plus fort en dernier).
    const hints: WhoIsItHint[] = [
      {
        type: 'BLURRED_COLOR',
        label: 'Couleur floutée',
        value: 'Couleur dévoilée',
        cost: hintCost,
        unlockedAtMistakeCount: 1,
        isRevealed: false,
      },
      {
        type: 'TYPE_1',
        label: 'Type 1',
        value: type1,
        cost: hintCost,
        unlockedAtMistakeCount: 2,
        isRevealed: false,
      },
      {
        type: 'TYPE_2',
        label: 'Type 2',
        value: type2,
        cost: hintCost,
        unlockedAtMistakeCount: 3,
        isRevealed: false,
      },
      {
        type: 'GENERATION',
        label: 'Génération',
        value: target.generation,
        cost: hintCost,
        unlockedAtMistakeCount: 4,
        isRevealed: false,
      },
      {
        type: 'FIRST_LETTER',
        label: 'Première lettre',
        value: target.nameFr.charAt(0) + '...',
        cost: hintCost,
        unlockedAtMistakeCount: 5,
        isRevealed: false,
      },
    ];

    const session: InternalRoundSession = {
      roundId,
      sessionHash,
      targetPokemonId: target.id,
      targetNameFr: target.nameFr,
      targetNameEn: target.nameEn,
      status: 'PLAYING',
      startTime: Date.now(),
      currentScore: startCapital,
      mistakesCount: 0,
      hintsUsedCount: 0,
      mode,
      roundIndex,
      totalRounds,
      hints,
      ...(userId ? { userId } : {}),
    };

    await this.redisService.set(
      `${this.REDIS_PREFIX}${roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );

    return {
      roundId,
      sessionHash,
      spriteProxyUrl: `/api/sprites/${sessionHash}`,
      status: 'PLAYING',
      startTime: session.startTime,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      mode: session.mode,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: session.hints,
      ...(userId ? {} : { guestUsername: 'Dresseur Invité' }),
    };
  }

  async getRoundState(roundId: string): Promise<WhoIsItRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }
    const session = JSON.parse(raw) as InternalRoundSession;
    return {
      roundId: session.roundId,
      sessionHash: session.sessionHash,
      spriteProxyUrl: `/api/sprites/${session.sessionHash}`,
      status: session.status,
      startTime: session.startTime,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      mode: session.mode,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: session.hints,
      ...(session.userId ? {} : { guestUsername: 'Dresseur Invité' }),
    };
  }

  /**
   * Permet à un joueur d'acheter et de débloquer un indice s'il a atteint le palier d'erreur requis.
   */
  async requestHint(roundId: string, hintType: WhoIsItHintType): Promise<WhoIsItRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    const session = JSON.parse(raw) as InternalRoundSession;
    if (session.status !== 'PLAYING') {
      throw new BadRequestException('Cette manche est déjà terminée');
    }

    const hint = session.hints.find((h) => h.type === hintType);
    if (!hint) {
      throw new NotFoundException('Indice introuvable');
    }

    if (hint.isRevealed) {
      throw new BadRequestException('Cet indice est déjà révélé');
    }

    if (session.mistakesCount < hint.unlockedAtMistakeCount) {
      throw new BadRequestException(`Il faut ${hint.unlockedAtMistakeCount} erreurs pour débloquer cet indice`);
    }

    // Achat de l'indice : déduction du coût
    hint.isRevealed = true;
    session.currentScore = Math.max(0, session.currentScore - hint.cost);
    session.hintsUsedCount++;

    // L'indice de couleur passe par le proxy : la version floutée colorée devient servie, jamais le sprite net
    if (hint.type === 'BLURRED_COLOR') {
      await this.spriteProxy.revealColorSpriteSession(session.sessionHash);
    }

    await this.redisService.set(`${this.REDIS_PREFIX}${roundId}`, JSON.stringify(session), this.ROUND_TTL_SECONDS);

    return {
      roundId: session.roundId,
      sessionHash: session.sessionHash,
      spriteProxyUrl: `/api/sprites/${session.sessionHash}`,
      status: session.status,
      startTime: session.startTime,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      mode: session.mode,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: session.hints,
      ...(session.userId ? {} : { guestUsername: 'Dresseur Invité' }),
    };
  }

  /**
   * Soumet une tentative (tentatives illimitées jusqu'à trouver).
   */
  async submitGuess(roundId: string, guess: string, userId?: string): Promise<WhoIsItGuessResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    const session = JSON.parse(raw) as InternalRoundSession;
    if (session.status !== 'PLAYING') {
      throw new BadRequestException('Cette manche est déjà terminée');
    }

    if (userId && !session.userId) {
      session.userId = userId;
    }

    const normalizedGuess = this.normalizeName(guess);
    const normalizedTargetFr = this.normalizeName(session.targetNameFr);
    const normalizedTargetEn = this.normalizeName(session.targetNameEn);

    const isCorrect = normalizedGuess === normalizedTargetFr || normalizedGuess === normalizedTargetEn;

    if (!isCorrect) {
      session.mistakesCount++;
      session.currentScore = Math.max(0, session.currentScore - 15);
      await this.redisService.set(`${this.REDIS_PREFIX}${roundId}`, JSON.stringify(session), this.ROUND_TTL_SECONDS);

      return {
        success: true,
        isCorrect: false,
        status: 'PLAYING',
        message: 'Ce n’est pas le bon Pokémon ! (-15 points)',
        currentScore: session.currentScore,
        mistakesCount: session.mistakesCount,
        hints: session.hints,
        revealedPokemon: null,
        unmaskedSpriteUrl: null,
        ...(session.userId ? {} : { guestUsername: 'Dresseur Invité' }),
      };
    }

    // Victoire !
    session.status = 'SOLVED';
    await this.spriteProxy.revealSpriteSession(session.sessionHash);
    await this.redisService.set(`${this.REDIS_PREFIX}${roundId}`, JSON.stringify(session), this.ROUND_TTL_SECONDS);

    const fullPokemon = await this.getFullPokemonDTO(session.targetPokemonId);
    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

    const effectiveUserId = session.userId ?? userId;
    if (effectiveUserId) {
      try {
        await this.prisma.gameHistory.create({
          data: {
            userId: effectiveUserId,
            gameType: 'WHO_IS_IT',
            score: session.currentScore,
            isMulti: false,
          },
        });
      } catch {
        // Ignorer si le user n'existe pas ou erreur FK
      }
    }

    const auditEvent = new GameRoundCompletedEvent(
      session.roundId,
      'WHO_IS_IT',
      session.targetPokemonId,
      session.targetNameFr,
      true,
      durationSeconds,
      session.hintsUsedCount,
      session.currentScore,
      guess,
      effectiveUserId,
      false,
    );
    this.eventEmitter.emit('game.round.completed', auditEvent);

    return {
      success: true,
      isCorrect: true,
      status: 'SOLVED',
      message: `Bonne réponse ! Vous gagnez ${session.currentScore} points !`,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      hints: session.hints,
      revealedPokemon: fullPokemon,
      unmaskedSpriteUrl: `/api/sprites/${session.sessionHash}`,
      durationSeconds,
      ...(effectiveUserId ? {} : { guestUsername: 'Dresseur Invité', canCreateAccountToSave: true }),
    };
  }

  private normalizeName(str: string): string {
    return str
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private async getFullPokemonDTO(pokemonId: number): Promise<PokemonDTO | null> {
    const dbPok = await this.prisma.pokemon.findUnique({
      where: { id: pokemonId },
      include: {
        types: { include: { type: true }, orderBy: { slot: 'asc' } },
        evolutions: { include: { target: true } },
        evolvedFrom: { include: { pokemon: true } },
      },
    });

    if (!dbPok) return null;

    return {
      id: dbPok.id,
      pokedexId: dbPok.pokedexId,
      nameFr: dbPok.nameFr,
      nameEn: dbPok.nameEn,
      category: dbPok.category,
      generation: dbPok.generation,
      spriteRegular: dbPok.spriteRegular,
      spriteShiny: dbPok.spriteShiny,
      stats: {
        hp: dbPok.statsHp,
        atk: dbPok.statsAtk,
        def: dbPok.statsDef,
        speAtk: dbPok.statsSpeAtk,
        speDef: dbPok.statsSpeDef,
        speed: dbPok.statsSpeed,
      },
      weight: dbPok.weight,
      height: dbPok.height,
      types: dbPok.types.map((pt) => ({
        id: pt.type.id,
        nameFr: pt.type.nameFr,
        nameEn: pt.type.nameEn,
        image: pt.type.image,
      })),
      evolutions: dbPok.evolutions.map((ev) => ({
        pokedexId: ev.target.pokedexId,
        nameFr: ev.target.nameFr,
        condition: ev.condition,
      })),
      evolvedFrom: dbPok.evolvedFrom.map((ev) => ({
        pokedexId: ev.pokemon.pokedexId,
        nameFr: ev.pokemon.nameFr,
        condition: ev.condition,
      })),
    };
  }
}
