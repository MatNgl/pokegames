import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DailyMetrics {
  won?: boolean;
  attempts?: number | null;
  score?: number | null;
  correctCount?: number | null;
  totalRounds?: number | null;
  durationSeconds?: number | null;
}

export interface DailyResultRow extends DailyMetrics {
  gameType: string;
  scope: string;
  dayDate: Date;
}

export interface LeaderboardRow extends DailyMetrics {
  userId: string;
  username: string;
}

/**
 * Resultats quotidiens des joueurs connectes : verrou de l'unicite du jour, historique et classements.
 * Autorite serveur : ecrit uniquement a la completion cote service de jeu, jamais sur signalement client.
 */
@Injectable()
export class DailyResultService {
  constructor(private readonly prisma: PrismaService) {}

  private utcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  /** Vrai si le joueur a deja termine ce defi (jeu x scope) aujourd'hui. */
  async hasCompleted(userId: string, gameType: string, scope: string, day: Date): Promise<boolean> {
    const count = await this.prisma.dailyResult.count({
      where: { userId, gameType, scope, dayDate: this.utcDateOnly(day) },
    });
    return count > 0;
  }

  /** Enregistre le resultat du jour. Idempotent : le premier resultat fait foi (verrou strict). */
  async record(
    userId: string,
    gameType: string,
    scope: string,
    day: Date,
    metrics: DailyMetrics,
  ): Promise<void> {
    try {
      await this.prisma.dailyResult.create({
        data: {
          userId,
          gameType,
          scope,
          dayDate: this.utcDateOnly(day),
          won: metrics.won ?? false,
          attempts: metrics.attempts ?? null,
          score: metrics.score ?? null,
          correctCount: metrics.correctCount ?? null,
          totalRounds: metrics.totalRounds ?? null,
          durationSeconds: metrics.durationSeconds ?? null,
        },
      });
    } catch (error) {
      // Doublon (deja enregistre aujourd'hui) : on ignore, le premier resultat reste.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  /** Resultats du joueur pour un jour donne (statut d'accueil, quetes). */
  async listForDay(userId: string, day: Date): Promise<DailyResultRow[]> {
    const rows = await this.prisma.dailyResult.findMany({
      where: { userId, dayDate: this.utcDateOnly(day) },
      select: {
        gameType: true,
        scope: true,
        dayDate: true,
        won: true,
        attempts: true,
        score: true,
        correctCount: true,
        totalRounds: true,
        durationSeconds: true,
      },
    });
    return rows;
  }

  /**
   * Ordre du classement selon le jeu : Motus et Silhouette (gagne puis moins d'essais), autres
   * (plus de bonnes reponses). Egalite departagee par la duree (plus rapide devant).
   */
  private compare(gameType: string, a: LeaderboardRow, b: LeaderboardRow): number {
    const duration = (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity);
    if (gameType === 'MOTUS' || gameType === 'WHO_IS_IT') {
      if ((a.won ?? false) !== (b.won ?? false)) return a.won ? -1 : 1;
      const diff = (a.attempts ?? Infinity) - (b.attempts ?? Infinity);
      return diff !== 0 ? diff : duration;
    }
    const diff = (b.correctCount ?? -Infinity) - (a.correctCount ?? -Infinity);
    return diff !== 0 ? diff : duration;
  }

  /** Classement du jour pour un defi (jeu x scope), trie selon la metrique du jeu. */
  async leaderboard(gameType: string, scope: string, day: Date): Promise<LeaderboardRow[]> {
    const rows = await this.prisma.dailyResult.findMany({
      where: { gameType, scope, dayDate: this.utcDateOnly(day) },
      select: {
        userId: true,
        won: true,
        attempts: true,
        score: true,
        correctCount: true,
        totalRounds: true,
        durationSeconds: true,
        user: { select: { username: true } },
      },
    });
    const mapped: LeaderboardRow[] = rows.map((r) => ({
      userId: r.userId,
      username: r.user.username,
      won: r.won,
      attempts: r.attempts,
      score: r.score,
      correctCount: r.correctCount,
      totalRounds: r.totalRounds,
      durationSeconds: r.durationSeconds,
    }));
    mapped.sort((a, b) => this.compare(gameType, a, b));
    return mapped;
  }

  /** Historique recent du joueur (Lot 2). */
  async history(userId: string, limit = 50): Promise<DailyResultRow[]> {
    return this.prisma.dailyResult.findMany({
      where: { userId },
      orderBy: [{ dayDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        gameType: true,
        scope: true,
        dayDate: true,
        won: true,
        attempts: true,
        score: true,
        correctCount: true,
        totalRounds: true,
        durationSeconds: true,
      },
    });
  }
}
