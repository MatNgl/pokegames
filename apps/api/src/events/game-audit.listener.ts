import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { GameRoundCompletedEvent } from './game-round-completed.event';

@Injectable()
export class GameAuditListener {
  private readonly logger = new Logger(GameAuditListener.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tâche asynchrone (Job Event) écoutant la fin des parties pour alimenter
   * l'historique admin et le suivi anti-triche sans bloquer la réponse de jeu.
   */
  @OnEvent('game.round.completed', { async: true })
  async handleGameRoundCompletedEvent(payload: GameRoundCompletedEvent): Promise<void> {
    this.logger.log(
      `[Job Event] Audit de fin de manche [${payload.gameType}] - Round: ${payload.roundId} - Succès: ${payload.isSuccess} (${payload.durationSeconds}s)`,
    );

    try {
      await this.prisma.gameAuditLog.create({
        data: {
          roundId: payload.roundId,
          gameType: payload.gameType,
          userId: payload.userId ?? null,
          targetPokemonId: payload.targetPokemonId,
          targetNameFr: payload.targetNameFr,
          userGuess: payload.userGuess ?? null,
          isSuccess: payload.isSuccess,
          scoreEarned: payload.scoreEarned,
          durationSeconds: payload.durationSeconds,
          hintsUsedCount: payload.hintsUsedCount,
          isMultiplayer: payload.isMultiplayer,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors de l'enregistrement de l'audit de jeu [${payload.roundId}]: ${errorMessage}`);
    }
  }
}
