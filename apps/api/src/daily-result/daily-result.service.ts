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

/**
 * Identite d'un joueur pour l'enregistrement d'un resultat : soit un compte (userId), soit un
 * invite (guestId + guestName genere cote client). Exactement un des deux doit etre renseigne.
 */
export interface PlayerIdentity {
  userId?: string | undefined;
  guestId?: string | undefined;
  guestName?: string | undefined;
}

export interface LeaderboardRow extends DailyMetrics {
  userId: string | null;
  guestId: string | null;
  username: string;
  isGuest: boolean;
}

/**
 * Extrait l'identite de joueur d'une session de jeu (Redis). Le compte prime sur l'invite.
 * Retourne {} si la session est anonyme (aucun resultat ne sera enregistre).
 */
export function playerFromSession(session: {
  userId?: string | undefined;
  guestId?: string | undefined;
  guestName?: string | undefined;
}): PlayerIdentity {
  if (session.userId) {
    return { userId: session.userId };
  }
  if (session.guestId) {
    return { guestId: session.guestId, guestName: session.guestName };
  }
  return {};
}

/**
 * Champs invite prets a etre stockes dans une session (chaines toujours definies), ou objet vide
 * si le joueur est connecte ou anonyme. Evite d'ecrire `undefined` sous exactOptionalPropertyTypes.
 */
export function guestSessionFields(
  player: PlayerIdentity,
): { guestId: string; guestName: string } | Record<string, never> {
  if (player.userId || !player.guestId) {
    return {};
  }
  const suffix = player.guestId.replace(/[^A-Za-z0-9]/g, '').slice(-4) || '0000';
  return { guestId: player.guestId, guestName: player.guestName ?? `player_${suffix}` };
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

  /**
   * Enregistre le resultat du jour pour un compte ou un invite. Idempotent : le premier resultat
   * fait foi (verrou strict via l'index unique userId/guestId x jeu x scope x jour).
   * Sans identite de joueur (ni userId ni guestId), on n'enregistre rien.
   */
  async record(
    player: PlayerIdentity,
    gameType: string,
    scope: string,
    day: Date,
    metrics: DailyMetrics,
  ): Promise<void> {
    if (!player.userId && !player.guestId) {
      return;
    }
    try {
      await this.prisma.dailyResult.create({
        data: {
          userId: player.userId ?? null,
          guestId: player.userId ? null : (player.guestId ?? null),
          guestName: player.userId ? null : (player.guestName ?? null),
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
        guestId: true,
        guestName: true,
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
      guestId: r.guestId,
      username: r.user?.username ?? r.guestName ?? 'Invité',
      isGuest: !r.userId,
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
