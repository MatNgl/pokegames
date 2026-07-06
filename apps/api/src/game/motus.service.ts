import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import { HistoryService } from '../history/history.service';
import {
  DailyResultService,
  guestSessionFields,
  playerFromSession,
  type PlayerIdentity,
} from '../daily-result/daily-result.service';
import { GameConfigService } from '../game-config/game-config.service';
import type {
  MotusGuessResponse,
  MotusGuessRow,
  MotusLetterResult,
  MotusLetterState,
  MotusRoundState,
  MotusLevel,
} from '@pokegames/shared-types';

const MOTUS_LEVELS: MotusLevel[] = ['FACILE', 'MOYEN', 'DIFFICILE', 'EXTREME'];

interface MotusTarget {
  pokemonId: number;
  word: string; // normalise A-Z
}

interface MotusSession {
  roundId: string;
  pokemonId: number;
  answer: string; // normalise A-Z
  length: number;
  maxAttempts: number;
  level?: MotusLevel;
  attempts: MotusGuessRow[];
  status: 'PLAYING' | 'WON' | 'LOST';
  startTime: number;
  userId?: string;
  guestId?: string;
  guestName?: string;
}

@Injectable()
export class MotusService {
  private readonly REDIS_PREFIX = 'game_motus:';
  private readonly ROUND_TTL_SECONDS = 3600;
  private readonly MIN_LENGTH = 5;
  private readonly MAX_LENGTH = 9;

  private targetsCache: MotusTarget[] | null = null;
  private validWordsCache: Set<string> | null = null;
  private planCache: { date: string; plan: Record<MotusLevel, MotusTarget | null> } | null = null;
  private readonly HISTORY_GAME = 'MOTUS';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly history: HistoryService,
    private readonly dailyResult: DailyResultService,
    private readonly gameConfig: GameConfigService,
  ) {}

  /** Retire les accents et ne garde que les lettres A a Z (majuscules). */
  private normalize(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
  }

  /** Un seul mot, uniquement des lettres (pas d'espace, tiret, point ou symbole). */
  private isSingleWord(name: string): boolean {
    return /^[A-Za-z]+$/.test(name.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  }

  private async loadData(): Promise<{ targets: MotusTarget[]; validWords: Set<string> }> {
    if (this.targetsCache && this.validWordsCache) {
      return { targets: this.targetsCache, validWords: this.validWordsCache };
    }
    const rows = await this.prisma.pokemon.findMany({ select: { id: true, nameFr: true } });
    const validWords = new Set<string>();
    const targets: MotusTarget[] = [];
    for (const row of rows) {
      if (!this.isSingleWord(row.nameFr)) continue;
      const word = this.normalize(row.nameFr);
      if (word.length === 0) continue;
      validWords.add(word);
      if (word.length >= this.MIN_LENGTH && word.length <= this.MAX_LENGTH) {
        targets.push({ pokemonId: row.id, word });
      }
    }
    targets.sort((a, b) => a.pokemonId - b.pokemonId);
    this.targetsCache = targets;
    this.validWordsCache = validWords;
    return { targets, validWords };
  }

  private dailyIndex(count: number, level: MotusLevel = 'MOYEN'): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i) + level.charCodeAt(0) * 17) % 2147483647;
    }
    return Math.abs(seed) % count;
  }

  /**
   * Mot du jour par niveau : distinct entre niveaux (meme jour) et sans reproposer un mot tire ces
   * derniers jours (anti-repetition par niveau). Repli si l'exclusion vide le pool. Enregistre 1 fois/jour.
   */
  private async getDailyPlan(targets: MotusTarget[]): Promise<Record<MotusLevel, MotusTarget | null>> {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    if (this.planCache && this.planCache.date === today) {
      return this.planCache.plan;
    }
    const now = new Date();
    const used = new Set<number>();
    const plan = {} as Record<MotusLevel, MotusTarget | null>;
    for (const level of MOTUS_LEVELS) {
      const cfg = this.gameConfig.motus().levels[level];
      const filtered = targets.filter(
        (t) => t.word.length >= cfg.minWordLength && t.word.length <= cfg.maxWordLength,
      );
      const base = filtered.length > 0 ? filtered : targets;
      const recent = await this.history.recentPokemonIds(
        this.HISTORY_GAME,
        level,
        now,
        this.gameConfig.antiRepeatWindow('MOTUS'),
      );
      let avail = base.filter((t) => !used.has(t.pokemonId) && !recent.has(t.pokemonId));
      if (avail.length === 0) avail = base.filter((t) => !used.has(t.pokemonId)); // repli cross-jours
      if (avail.length === 0) avail = base; // repli total
      const pick = avail.length > 0 ? (avail[this.dailyIndex(avail.length, level)] ?? null) : null;
      plan[level] = pick;
      if (pick) used.add(pick.pokemonId);
    }

    for (const level of MOTUS_LEVELS) {
      const pick = plan[level];
      if (pick && !(await this.history.hasPicksFor(this.HISTORY_GAME, level, now))) {
        await this.history.recordPicks(this.HISTORY_GAME, level, now, [{ pokemonId: pick.pokemonId }]);
      }
    }

    this.planCache = { date: today, plan };
    return plan;
  }

  private toState(session: MotusSession): MotusRoundState {
    const level = session.level ?? 'MOYEN';
    // La 1re lettre est fournie selon le niveau (source unique : game-config.ts).
    const hasFirstLetter = this.gameConfig.motus().levels[level].provideFirstLetter;
    return {
      roundId: session.roundId,
      level,
      length: session.length,
      maxAttempts: session.maxAttempts,
      attempts: session.attempts,
      status: session.status,
      firstLetter: hasFirstLetter ? session.answer.charAt(0) : null,
      answer: session.status === 'PLAYING' ? null : session.answer,
    };
  }

  /** Calcule le patron de couleurs, avec gestion correcte des lettres en double. */
  private evaluate(guess: string, answer: string): MotusLetterResult[] {
    const length = answer.length;
    const states: MotusLetterState[] = new Array<MotusLetterState>(length).fill('ABSENT');
    const remaining = new Map<string, number>();
    for (const char of answer) {
      remaining.set(char, (remaining.get(char) ?? 0) + 1);
    }
    for (let i = 0; i < length; i++) {
      const char = guess[i] ?? '';
      if (char === answer[i]) {
        states[i] = 'CORRECT';
        remaining.set(char, (remaining.get(char) ?? 0) - 1);
      }
    }
    for (let i = 0; i < length; i++) {
      if (states[i] === 'CORRECT') continue;
      const char = guess[i] ?? '';
      if ((remaining.get(char) ?? 0) > 0) {
        states[i] = 'PRESENT';
        remaining.set(char, (remaining.get(char) ?? 0) - 1);
      }
    }
    return Array.from({ length }, (_, i) => ({ letter: guess[i] ?? '', state: states[i] ?? 'ABSENT' }));
  }

  async startDaily(level: MotusLevel = 'FACILE', player: PlayerIdentity = {}): Promise<MotusRoundState> {
    const userId = player.userId;
    if (!MOTUS_LEVELS.includes(level)) {
      throw new BadRequestException('Niveau invalide');
    }
    if (userId && (await this.dailyResult.hasCompleted(userId, this.HISTORY_GAME, level, new Date()))) {
      throw new ConflictException('DAILY_ALREADY_COMPLETED');
    }
    const { targets } = await this.loadData();
    if (targets.length === 0) {
      throw new NotFoundException('Aucun Pokémon disponible pour le Motus. Lancez le script ETL.');
    }

    const maxAttempts = this.gameConfig.motus().levels[level].maxAttempts;
    const target = (await this.getDailyPlan(targets))[level];
    if (!target) {
      throw new NotFoundException('Mot du jour introuvable');
    }

    const roundId = uuidv4();
    const session: MotusSession = {
      roundId,
      pokemonId: target.pokemonId,
      answer: target.word,
      length: target.word.length,
      maxAttempts,
      level,
      attempts: [],
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : guestSessionFields(player)),
    };

    await this.redisService.set(
      `${this.REDIS_PREFIX}${roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );
    return this.toState(session);
  }

  async getRoundState(roundId: string): Promise<MotusRoundState> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as MotusSession;
    return this.toState(session);
  }

  async submitGuess(roundId: string, rawGuess: string, userId?: string): Promise<MotusGuessResponse> {
    const raw = await this.redisService.get(`${this.REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new NotFoundException('Partie introuvable ou expirée');
    }
    const session = JSON.parse(raw) as MotusSession;

    if (session.status !== 'PLAYING') {
      return { accepted: false, message: 'Partie déjà terminée', state: this.toState(session) };
    }

    const guess = this.normalize(rawGuess);
    const { validWords } = await this.loadData();

    if (guess.length !== session.length || !validWords.has(guess)) {
      return {
        accepted: false,
        message: "Ce n'est pas un Pokémon valide de cette longueur",
        state: this.toState(session),
      };
    }

    const letters = this.evaluate(guess, session.answer);
    session.attempts.push({ guess, letters });

    if (guess === session.answer) {
      session.status = 'WON';
    } else if (session.attempts.length >= session.maxAttempts) {
      session.status = 'LOST';
    }

    if (userId && !session.userId) {
      session.userId = userId;
    }

    await this.redisService.set(
      `${this.REDIS_PREFIX}${roundId}`,
      JSON.stringify(session),
      this.ROUND_TTL_SECONDS,
    );

    if (session.status !== 'PLAYING') {
      const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      const won = session.status === 'WON';
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'MOTUS',
          session.pokemonId,
          session.answer,
          won,
          durationSeconds,
          0,
          0,
          guess,
          session.userId,
          false,
        ),
      );
      const player = playerFromSession(session);
      if (player.userId || player.guestId) {
        await this.dailyResult.record(player, this.HISTORY_GAME, session.level ?? 'MOYEN', new Date(), {
          won,
          attempts: session.attempts.length,
          durationSeconds,
        });
      }
    }

    return { accepted: true, state: this.toState(session) };
  }
}
