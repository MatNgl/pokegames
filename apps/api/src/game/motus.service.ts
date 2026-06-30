import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameRoundCompletedEvent } from '../events/game-round-completed.event';
import type {
  MotusGuessResponse,
  MotusGuessRow,
  MotusLetterResult,
  MotusLetterState,
  MotusRoundState,
} from '@pokegames/shared-types';

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
  attempts: MotusGuessRow[];
  status: 'PLAYING' | 'WON' | 'LOST';
  startTime: number;
  userId?: string;
}

@Injectable()
export class MotusService {
  private readonly REDIS_PREFIX = 'game_motus:';
  private readonly ROUND_TTL_SECONDS = 3600;
  private readonly MAX_ATTEMPTS = 6;
  private readonly MIN_LENGTH = 5;
  private readonly MAX_LENGTH = 9;

  private targetsCache: MotusTarget[] | null = null;
  private validWordsCache: Set<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
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
    // Ordre deterministe pour que la graine du jour designe toujours le meme mot.
    targets.sort((a, b) => a.pokemonId - b.pokemonId);
    this.targetsCache = targets;
    this.validWordsCache = validWords;
    return { targets, validWords };
  }

  private dailyIndex(count: number): number {
    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) % 2147483647;
    }
    return Math.abs(seed) % count;
  }

  private toState(session: MotusSession): MotusRoundState {
    return {
      roundId: session.roundId,
      length: session.length,
      maxAttempts: session.maxAttempts,
      attempts: session.attempts,
      status: session.status,
      // Premiere lettre donnee comme indice de depart ; le reste du mot reste cache.
      firstLetter: session.answer.charAt(0),
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

  async startDaily(userId?: string): Promise<MotusRoundState> {
    const { targets } = await this.loadData();
    if (targets.length === 0) {
      throw new NotFoundException('Aucun Pokémon disponible pour le Motus. Lancez le script ETL.');
    }
    const target = targets[this.dailyIndex(targets.length)];
    if (!target) {
      throw new NotFoundException('Mot du jour introuvable');
    }

    const roundId = uuidv4();
    const session: MotusSession = {
      roundId,
      pokemonId: target.pokemonId,
      answer: target.word,
      length: target.word.length,
      maxAttempts: this.MAX_ATTEMPTS,
      attempts: [],
      status: 'PLAYING',
      startTime: Date.now(),
      ...(userId ? { userId } : {}),
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
      this.eventEmitter.emit(
        'game.round.completed',
        new GameRoundCompletedEvent(
          session.roundId,
          'MOTUS',
          session.pokemonId,
          session.answer,
          session.status === 'WON',
          durationSeconds,
          0,
          0,
          guess,
          session.userId,
          false,
        ),
      );
    }

    return { accepted: true, state: this.toState(session) };
  }
}
