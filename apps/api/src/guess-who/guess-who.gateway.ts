import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GUESS_WHO_EVENTS } from '@pokegames/shared-types';
import { GuessWhoService, type Emit } from './guess-who.service';

interface JwtPayload {
  sub: string;
  username: string;
}

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'pokegames-dev-secret-only';

@WebSocketGateway({ namespace: '/guess-who', cors: { origin: true, credentials: true } })
export class GuessWhoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GuessWhoGateway.name);

  constructor(
    private readonly service: GuessWhoService,
    private readonly jwt: JwtService,
  ) {
    // Le service demande la programmation du minuteur d'elimination ; le gateway l'execute.
    this.service.onScheduleExpire = (gameId, token, delayMs) => {
      setTimeout(() => this.dispatch(this.service.expire(gameId, token)), delayMs);
    };
  }

  private dispatch(emits: Emit[]): void {
    for (const e of emits) {
      this.server.to(e.socketId).emit(e.event, e.payload);
    }
  }

  private user(client: Socket): { userId: string; username: string; socketId: string } {
    const data = client.data as { userId: string; username: string };
    return { userId: data.userId, username: data.username, socketId: client.id };
  }

  handleConnection(client: Socket): void {
    try {
      const token = (client.handshake.auth?.['token'] as string | undefined) ?? '';
      const payload = this.jwt.verify<JwtPayload>(token, { secret: JWT_SECRET });
      client.data = { userId: payload.sub, username: payload.username };
      this.logger.log(`Connexion ${payload.username}`);
    } catch {
      client.emit(GUESS_WHO_EVENTS.errorMsg, { message: 'Connexion refusée : reconnecte-toi.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.dispatch(this.service.handleDisconnect(client.id));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.joinQueue)
  async onJoinQueue(@ConnectedSocket() client: Socket): Promise<void> {
    this.dispatch(await this.service.joinQueue(this.user(client)));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.createRoom)
  onCreateRoom(@ConnectedSocket() client: Socket): void {
    this.dispatch(this.service.createRoom(this.user(client)));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.joinRoom)
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code?: string },
  ): Promise<void> {
    this.dispatch(await this.service.joinRoom(body?.code ?? '', this.user(client)));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.cancel)
  onCancel(@ConnectedSocket() client: Socket): void {
    this.service.cancel(client.id);
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.ask)
  onAsk(@ConnectedSocket() client: Socket, @MessageBody() body: { text?: string }): void {
    this.dispatch(this.service.ask(client.id, body?.text ?? ''));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.answer)
  onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: { value?: boolean }): void {
    this.dispatch(this.service.answer(client.id, Boolean(body?.value)));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.finalGuess)
  onFinalGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { pokemonId?: number },
  ): void {
    if (typeof body?.pokemonId === 'number') {
      this.dispatch(this.service.finalGuess(client.id, body.pokemonId));
    }
  }
}
