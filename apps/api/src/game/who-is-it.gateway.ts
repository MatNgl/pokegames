import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WhoIsItService } from './who-is-it.service';
import { WhoIsItGuessRequest } from '@pokegames/shared-types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/games/who-is-it',
})
export class WhoIsItGateway {
  @WebSocketServer()
  server: Server | undefined;

  constructor(private readonly whoIsItService: WhoIsItService) {}

  @SubscribeMessage('START_ROUND')
  async handleStartRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() config?: { generations?: number[]; timeLimitSeconds?: number },
  ): Promise<void> {
    try {
      const state = await this.whoIsItService.startRound(config);
      client.emit('ROUND_STARTED', state);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur serveur au démarrage de la manche';
      client.emit('GAME_ERROR', { message });
    }
  }

  @SubscribeMessage('SUBMIT_GUESS')
  async handleSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WhoIsItGuessRequest,
  ): Promise<void> {
    try {
      const result = await this.whoIsItService.submitGuess(payload.roundId, payload.guess);
      client.emit('GUESS_RESULT', result);

      if (result.status === 'SOLVED' || result.status === 'TIMEOUT') {
        this.server?.emit('ROUND_ENDED', result);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la validation';
      client.emit('GAME_ERROR', { message });
    }
  }
}
