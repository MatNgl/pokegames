import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
  WhoIsItLevel,
} from '@pokegames/shared-types';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import { HistoryService } from '../history/history.service';
import {
  DailyResultService,
  guestSessionFields,
  playerFromSession,
  type PlayerIdentity,
} from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';

const WHO_IS_IT_LEVELS: WhoIsItLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE', 'EXTREME'];

/**
 * Anti-triche (Regle 2) : la valeur d'un indice non revele ne quitte jamais le serveur. La session
 * Redis porte les quatre valeurs des le tirage, mais les envoyer avec `isRevealed: false` revenait a
 * livrer le type, la taille exacte et la generation dans la toute premiere reponse : un joueur avec
 * l'onglet Reseau ouvert identifiait le Pokemon sans se tromper une seule fois, et l'endpoint
 * /hint ne servait plus a rien.
 */
function publicHints(hints: WhoIsItHint[]): WhoIsItHint[] {
  return hints.map((h) => (h.isRevealed ? h : { ...h, value: null }));
}

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
  level: WhoIsItLevel;
  zoomRatio: number;
  rotationAngle: number;
  roundIndex: number;
  totalRounds: number;
  hints: WhoIsItHint[];
  userId?: string;
  guestId?: string;
  guestName?: string;
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
    private readonly history: HistoryService,
    private readonly dailyResult: DailyResultService,
    private readonly gameConfig: GameConfigService,
  ) {}

  private readonly HISTORY_GAME = 'WHO_IS_IT';
  private readonly ATTEMPTS_PREFIX = 'whoisit_attempts:';
  private readonly ATTEMPTS_TTL_SECONDS = 172_800; // 2 jours : le defi du jour et son lendemain

  /**
   * Regle 4 (autorite du serveur) : le total d'essais du defi est cumule ici, et non transmis par le
   * client. Chaque manche a sa propre session Redis, le total etait donc renvoye par le navigateur
   * dans `carriedAttempts` : il suffisait de poster la derniere reponse avec 0 pour prendre la tete
   * du classement du jour. Le compteur est porte par (joueur, niveau, jour), hors de portee du client.
   */
  private attemptsKey(player: PlayerIdentity, level: WhoIsItLevel, day: Date): string {
    const who = player.userId ? `u:${player.userId}` : `g:${player.guestId ?? 'anon'}`;
    const dayKey = day.toISOString().slice(0, 10);
    return `${this.ATTEMPTS_PREFIX}${dayKey}:${level}:${who}`;
  }

  private async addAttempts(
    player: PlayerIdentity,
    level: WhoIsItLevel,
    day: Date,
    cost: number,
  ): Promise<number> {
    const key = this.attemptsKey(player, level, day);
    const previous = Number((await this.redisService.get(key)) ?? 0);
    const total = (Number.isFinite(previous) ? previous : 0) + cost;
    await this.redisService.set(key, String(total), this.ATTEMPTS_TTL_SECONDS);
    return total;
  }

  // Zoom et rotation dependent du niveau et du nombre d'erreurs. Source unique : game-config.ts
  // (this.gameConfig.whoIsIt()). Le zoom se reduit et l'angle se redresse a chaque erreur.
  private computeVisuals(
    level: WhoIsItLevel = 'MOYEN',
    mistakes: number,
  ): { zoomRatio: number; rotationAngle: number } {
    const cfg = this.gameConfig.whoIsIt().levels[level] ?? this.gameConfig.whoIsIt().levels.MOYEN;
    const zoom = Math.max(1.0, cfg.initialZoomRatio - mistakes * cfg.zoomStepPerMistake);
    const angle = Math.max(0, cfg.initialRotationAngle - mistakes * cfg.rotationStepPerMistake);
    return { zoomRatio: Number(zoom.toFixed(2)), rotationAngle: Math.round(angle) };
  }

  private makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  // Graine du jour (date UTC seule) : la permutation est identique pour tous les niveaux, ce qui
  // rend le decoupage en tranches disjointes coherent quel que soit le niveau demande.
  private dailyShuffleSeed(): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 7;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return seed || 1;
  }

  /**
   * Serie deterministe du jour pour un niveau. Melange le catalogue (graine du jour) puis attribue a
   * chaque niveau, dans l'ordre, des Pokemon non encore utilises et compatibles avec ses generations.
   * Garantit qu'aucun Pokemon n'est partage entre deux niveaux le meme jour, ni repete dans une serie.
   */
  private buildDailySeriesAll<T extends { id: number; generation: number }>(
    all: T[],
    roundsCount: number,
    recentByLevel: Map<WhoIsItLevel, Set<number>>,
  ): Map<WhoIsItLevel, T[]> {
    const rng = this.makeRng(this.dailyShuffleSeed());
    const perm = [...all];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = perm[i];
      const b = perm[j];
      if (a && b) {
        perm[i] = b;
        perm[j] = a;
      }
    }

    const used = new Set<number>();
    const seriesByLevel = new Map<WhoIsItLevel, T[]>();
    for (const lvl of WHO_IS_IT_LEVELS) {
      const gens = this.gameConfig.whoIsIt().levels[lvl].allowedGenerations;
      const recent = recentByLevel.get(lvl) ?? new Set<number>();
      const picks: T[] = [];
      for (const pokemon of perm) {
        if (picks.length >= roundsCount) break;
        if (used.has(pokemon.id)) continue; // dedup entre niveaux du jour
        if (recent.has(pokemon.id)) continue; // anti-repetition cross-jours (par niveau)
        if (!gens.includes(pokemon.generation)) continue;
        picks.push(pokemon);
        used.add(pokemon.id);
      }
      seriesByLevel.set(lvl, picks);
    }
    return seriesByLevel;
  }

  /**
   * Démarre une nouvelle manche avec capital 100 points, pas d'échec au temps et indices payants.
   */
  async startRound(
    config: WhoIsItConfig = { generations: [] },
    player: PlayerIdentity = {},
    roundIndex = 1,
  ): Promise<WhoIsItRoundState> {
    const userId = player.userId;
    const mode = config.mode ?? 'CLASSIC';
    const level = config.level ?? 'MOYEN';
    if (!WHO_IS_IT_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    const levelConfig = this.gameConfig.whoIsIt().levels[level];
    const totalRounds = config.roundsCount ?? this.gameConfig.whoIsIt().roundsCount;
    const startCapital = config.startCapital ?? this.gameConfig.whoIsIt().startCapital;

    // Nouveau defi : le compteur d'essais du jour repart de zero. Sans cela, un joueur dont le defi
    // a ete remis a zero par un administrateur reprendrait avec le total de sa tentative precedente.
    if (mode === 'DAILY' && roundIndex <= 1 && (player.userId || player.guestId)) {
      await this.redisService.set(
        this.attemptsKey(player, level, new Date()),
        '0',
        this.ATTEMPTS_TTL_SECONDS,
      );
    }

    // Catalogue complet, ordre stable (indispensable au tirage deterministe du jour).
    const pokemons = await this.prisma.pokemon.findMany({
      include: {
        types: {
          include: { type: true },
          orderBy: { slot: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (pokemons.length === 0) {
      throw new NotFoundException('Aucun Pokémon disponible. Lancez le script ETL.');
    }

    type PokemonWithTypes = (typeof pokemons)[number];
    let target: PokemonWithTypes | undefined;
    if (mode === 'DAILY') {
      // Verrou serveur : au demarrage du defi (1re manche), on refuse si deja termine aujourd'hui.
      if (
        roundIndex === 1 &&
        userId &&
        (await this.dailyResult.hasCompleted(userId, this.HISTORY_GAME, level, new Date()))
      ) {
        throw new ConflictException('DAILY_ALREADY_COMPLETED');
      }
      // Serie du jour propre au niveau : DISJOINTE entre niveaux (meme jour), sans repetition dans
      // la serie, et sans reproposer un Pokemon tire ces derniers jours (anti-repetition par niveau).
      const now = new Date();
      const recentByLevel = new Map<WhoIsItLevel, Set<number>>();
      for (const lvl of WHO_IS_IT_LEVELS) {
        recentByLevel.set(
          lvl,
          await this.history.recentPokemonIds(
            this.HISTORY_GAME,
            lvl,
            now,
            this.gameConfig.antiRepeatWindow('WHO_IS_IT'),
          ),
        );
      }
      let seriesByLevel = this.buildDailySeriesAll(pokemons, totalRounds, recentByLevel);
      // Repli sans historique si l'exclusion rend la serie du niveau incomplete.
      if ((seriesByLevel.get(level)?.length ?? 0) < totalRounds) {
        seriesByLevel = this.buildDailySeriesAll(pokemons, totalRounds, new Map());
      }
      const series = seriesByLevel.get(level) ?? [];
      target = series[roundIndex - 1] ?? series[0];

      if (!(await this.history.hasPicksFor(this.HISTORY_GAME, level, now))) {
        await this.history.recordPicks(
          this.HISTORY_GAME,
          level,
          now,
          series.map((p) => ({ pokemonId: p.id })),
        );
      }
    } else {
      const eligibleGenerations =
        config.generations && config.generations.length > 0
          ? config.generations
          : levelConfig.allowedGenerations;
      const pool = pokemons.filter((p) => eligibleGenerations.includes(p.generation));
      target = pool[Math.floor(Math.random() * pool.length)];
    }
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
    // height est stocke en metres (ETL : "0,7 m" -> 0.7). Ne pas rediviser.
    const heightStr = target.height != null ? `${target.height.toFixed(1)} m` : 'Inconnue';
    const hintCosts = this.gameConfig.whoIsIt().hintCosts;
    const hintUnlocks = this.gameConfig.whoIsIt().hintUnlocks;

    const hints: WhoIsItHint[] = [
      {
        type: 'TYPE_1',
        label: 'Type 1',
        value: type1,
        cost: hintCosts.TYPE_1 ?? 0,
        unlockedAtMistakeCount: hintUnlocks.TYPE_1 ?? 1,
        isRevealed: false,
      },
      {
        type: 'HEIGHT',
        label: 'Taille',
        value: heightStr,
        cost: hintCosts.HEIGHT ?? 0,
        unlockedAtMistakeCount: hintUnlocks.HEIGHT ?? 2,
        isRevealed: false,
      },
      {
        type: 'GENERATION',
        label: 'Génération',
        value: target.generation,
        cost: hintCosts.GENERATION ?? 0,
        unlockedAtMistakeCount: hintUnlocks.GENERATION ?? 3,
        isRevealed: false,
      },
      {
        type: 'BLURRED_COLOR',
        label: 'Aperçu couleur',
        value: 'Couleur dévoilée',
        cost: hintCosts.BLURRED_COLOR ?? 0,
        unlockedAtMistakeCount: hintUnlocks.BLURRED_COLOR ?? 4,
        isRevealed: false,
      },
    ];

    const visuals = this.computeVisuals(level, 0);

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
      level,
      zoomRatio: visuals.zoomRatio,
      rotationAngle: visuals.rotationAngle,
      roundIndex,
      totalRounds,
      hints,
      ...(userId ? { userId } : guestSessionFields(player)),
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
      level: session.level,
      zoomRatio: session.zoomRatio,
      rotationAngle: session.rotationAngle,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: publicHints(session.hints),
      ...(userId ? {} : { guestUsername: 'Dresseur Invité' }),
    };
  }

  async getRoundState(roundId: string): Promise<WhoIsItRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }
    const session = JSON.parse(raw) as InternalRoundSession;
    session.level = session.level ?? 'MOYEN';
    const visuals = this.computeVisuals(session.level, session.mistakesCount);
    return {
      roundId: session.roundId,
      sessionHash: session.sessionHash,
      spriteProxyUrl: `/api/sprites/${session.sessionHash}`,
      status: session.status,
      startTime: session.startTime,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      mode: session.mode,
      level: session.level,
      zoomRatio: visuals.zoomRatio,
      rotationAngle: visuals.rotationAngle,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: publicHints(session.hints),
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
    session.level = session.level ?? 'MOYEN';
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

    if (hint.type === 'BLURRED_COLOR') {
      await this.spriteProxy.setColorLevel(session.sessionHash, 1);
    }

    await this.redisService.set(`${this.REDIS_PREFIX}${roundId}`, JSON.stringify(session), this.ROUND_TTL_SECONDS);

    const visuals = this.computeVisuals(session.level, session.mistakesCount);
    return {
      roundId: session.roundId,
      sessionHash: session.sessionHash,
      spriteProxyUrl: `/api/sprites/${session.sessionHash}`,
      status: session.status,
      startTime: session.startTime,
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      mode: session.mode,
      level: session.level,
      zoomRatio: visuals.zoomRatio,
      rotationAngle: visuals.rotationAngle,
      roundIndex: session.roundIndex,
      totalRounds: session.totalRounds,
      hints: publicHints(session.hints),
      ...(session.userId ? {} : { guestUsername: 'Dresseur Invité' }),
    };
  }

  async submitGuess(
    roundId: string,
    guess: string,
    userId?: string,
  ): Promise<WhoIsItGuessResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    const session = JSON.parse(raw) as InternalRoundSession;
    session.level = session.level ?? 'MOYEN';
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
      const visuals = this.computeVisuals(session.level, session.mistakesCount);
      session.zoomRatio = visuals.zoomRatio;
      session.rotationAngle = visuals.rotationAngle;
      await this.redisService.set(`${this.REDIS_PREFIX}${roundId}`, JSON.stringify(session), this.ROUND_TTL_SECONDS);

      return {
        success: true,
        isCorrect: false,
        status: 'PLAYING',
        message: 'Ce n’est pas le bon Pokémon !',
        currentScore: session.currentScore,
        mistakesCount: session.mistakesCount,
        level: session.level,
        zoomRatio: session.zoomRatio,
        rotationAngle: session.rotationAngle,
        hints: publicHints(session.hints),
        revealedPokemon: null,
        unmaskedSpriteUrl: null,
        ...(session.userId ? {} : { guestUsername: 'Dresseur Invité' }),
      };
    }

    // Victoire !
    return this.finalizeRound(session, true, guess);
  }

  /**
   * Passe la manche sans deviner : revele le Pokemon comme une victoire, mais coute 3 essais au
   * classement (contre 1 pour une manche trouvee du premier coup), pour dissuader de tout passer.
   */
  async skipRound(
    roundId: string,
    userId?: string,
  ): Promise<WhoIsItGuessResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Manche introuvable ou expirée');
    }

    const session = JSON.parse(raw) as InternalRoundSession;
    session.level = session.level ?? 'MOYEN';
    if (session.status !== 'PLAYING') {
      throw new BadRequestException('Cette manche est déjà terminée');
    }

    if (userId && !session.userId) {
      session.userId = userId;
    }

    return this.finalizeRound(session, false, '(passé)');
  }

  /** Cloture une manche (trouvee ou passee) : revele le sprite, journalise et renvoie l'etat final. */
  private async finalizeRound(
    session: InternalRoundSession,
    isCorrect: boolean,
    guess: string,
  ): Promise<WhoIsItGuessResponse> {
    session.status = 'SOLVED';
    session.zoomRatio = 1.0;
    session.rotationAngle = 0;
    await this.spriteProxy.revealSpriteSession(session.sessionHash);
    await this.redisService.set(
      `${this.REDIS_PREFIX}${session.roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );

    const fullPokemon = await this.getFullPokemonDTO(session.targetPokemonId);
    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

    const effectiveUserId = session.userId;
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
      isCorrect,
      durationSeconds,
      session.hintsUsedCount,
      session.currentScore,
      guess,
      effectiveUserId,
      false,
    );
    this.eventEmitter.emit('game.round.completed', auditEvent);

    // Classement par nombre d'essais (plus de points) : une manche trouvee coute (erreurs + 1),
    // une manche passee coute 3 essais. Le cumul des manches est tenu par le serveur (addAttempts).
    const player: PlayerIdentity = playerFromSession(session);
    if (session.mode === 'DAILY' && (player.userId || player.guestId)) {
      const day = new Date();
      const roundCost = session.mistakesCount + (isCorrect ? 1 : 3);
      const total = await this.addAttempts(player, session.level, day, roundCost);

      // Defi quotidien termine (derniere manche resolue ou passee) : enregistrement du resultat.
      if (session.roundIndex >= session.totalRounds) {
        await this.dailyResult.record(player, this.HISTORY_GAME, session.level, day, {
          won: true,
          attempts: total,
          totalRounds: session.totalRounds,
          durationSeconds,
        });
      }
    }

    return {
      success: true,
      isCorrect,
      skipped: !isCorrect,
      status: 'SOLVED',
      message: isCorrect ? 'Bonne réponse !' : 'Pokémon révélé.',
      currentScore: session.currentScore,
      mistakesCount: session.mistakesCount,
      level: session.level,
      zoomRatio: 1.0,
      rotationAngle: 0,
      hints: publicHints(session.hints),
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
