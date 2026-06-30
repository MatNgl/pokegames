import { GameType } from '@pokegames/shared-types';

/**
 * Événement de domaine émis de manière asynchrone lors de la fin d'une manche de mini-jeu.
 * Permet au système d'audit et de statistiques admin d'enregistrer l'historique en tâche de fond (Job Event).
 */
export class GameRoundCompletedEvent {
  constructor(
    public readonly roundId: string,
    public readonly gameType: GameType,
    public readonly targetPokemonId: number,
    public readonly targetNameFr: string,
    public readonly isSuccess: boolean,
    public readonly durationSeconds: number,
    public readonly hintsUsedCount: number,
    public readonly scoreEarned: number,
    public readonly userGuess?: string,
    public readonly userId?: string,
    public readonly isMultiplayer = false,
  ) {}
}
