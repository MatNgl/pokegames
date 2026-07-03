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
  // Minuteurs en attente par partie, pour les purger a la fin (evite les timers orphelins).
  private readonly timers = new Map<string, Set<ReturnType<typeof setTimeout>>>();

  constructor(
    private readonly service: GuessWhoService,
    private readonly jwt: JwtService,
  ) {
    // Le service demande la programmation du minuteur d'elimination ; le gateway l'execute.
    this.service.onScheduleExpire = (gameId, token, delayMs) => {
      this.schedule(gameId, delayMs, () => this.dispatch(this.service.expire(gameId, token)), 'expire');
    };
    // Forfait differe apres deconnexion (delai de grace pour reload / coupure transitoire).
    this.service.onScheduleForfeit = (gameId, index, token, delayMs) => {
      this.schedule(gameId, delayMs, () => this.dispatch(this.service.forfeitIfStillGone(gameId, index, token)), 'forfeit');
    };
    // Demarrage differe du 1er tour, apres l'intro.
    this.service.onScheduleStart = (gameId, delayMs) => {
      this.schedule(gameId, delayMs, () => this.dispatch(this.service.startFirstTurn(gameId)), 'start');
    };
    // Fin de partie : on annule tous les minuteurs restants de cette partie.
    this.service.onGameEnd = (gameId) => this.clearTimers(gameId);
  }

  // Programme un minuteur rattache a une partie et l'auto-nettoie a l'echeance.
  private schedule(gameId: string, delayMs: number, run: () => void, label: string): void {
    const handle = setTimeout(() => {
      this.untrack(gameId, handle);
      try {
        run();
      } catch (err) {
        this.logger.error(`Erreur minuteur ${label}`, err instanceof Error ? err.stack : String(err));
      }
    }, delayMs);
    let set = this.timers.get(gameId);
    if (!set) {
      set = new Set();
      this.timers.set(gameId, set);
    }
    set.add(handle);
  }

  private untrack(gameId: string, handle: ReturnType<typeof setTimeout>): void {
    const set = this.timers.get(gameId);
    if (!set) return;
    set.delete(handle);
    if (set.size === 0) this.timers.delete(gameId);
  }

  private clearTimers(gameId: string): void {
    const set = this.timers.get(gameId);
    if (!set) return;
    for (const handle of set) clearTimeout(handle);
    this.timers.delete(gameId);
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

  // Pseudo invite : nom d'affichage nettoye et borne, jamais persiste.
  private sanitizePseudo(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').slice(0, 20);
  }

  handleConnection(client: Socket): void {
    const token = (client.handshake.auth?.['token'] as string | undefined) ?? '';
    try {
      const payload = this.jwt.verify<JwtPayload>(token, { secret: JWT_SECRET });
      client.data = { userId: payload.sub, username: payload.username };
      this.logger.log(`Connexion ${payload.username}`);
      // Reconnexion auto a une partie en cours (reload de page ou coupure reseau transitoire).
      this.dispatch(this.service.reconnect(this.user(client)));
      return;
    } catch {
      // Pas de token valide : on autorise le mode invite si un pseudo est fourni.
    }

    const pseudo = this.sanitizePseudo(
      (client.handshake.auth?.['pseudo'] as string | undefined) ?? '',
    );
    if (!pseudo) {
      client.emit(GUESS_WHO_EVENTS.errorMsg, { message: 'Entre un pseudo pour jouer.' });
      client.disconnect(true);
      return;
    }
    // Invite : identifiant stable fourni par le client (sessionStorage) pour permettre la reconnexion
    // apres un reload ; repli sur un id ephemere par socket si absent.
    const guestId = this.sanitizeGuestId(
      (client.handshake.auth?.['guestId'] as string | undefined) ?? '',
    );
    client.data = { userId: guestId ? `guest:${guestId}` : `guest:${client.id}`, username: pseudo };
    this.logger.log(`Connexion invité ${pseudo}`);
    // Reconnexion auto a une partie en cours pour l'invite identifie.
    if (guestId) {
      this.dispatch(this.service.reconnect(this.user(client)));
    }
  }

  // Id invite : borne et restreint a des caracteres surs (evite l'injection d'une cle userId arbitraire).
  private sanitizeGuestId(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  }

  handleDisconnect(client: Socket): void {
    this.dispatch(this.service.handleDisconnect(client.id));
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.joinQueue)
  async onJoinQueue(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      this.dispatch(await this.service.joinQueue(this.user(client)));
    } catch (err) {
      this.logger.error('Erreur onJoinQueue', err instanceof Error ? err.stack : String(err));
      client.emit(GUESS_WHO_EVENTS.errorMsg, { message: 'Erreur serveur, réessaie.' });
    }
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.createRoom)
  onCreateRoom(@ConnectedSocket() client: Socket): void {
    try {
      this.dispatch(this.service.createRoom(this.user(client)));
    } catch (err) {
      this.logger.error('Erreur onCreateRoom', err instanceof Error ? err.stack : String(err));
      client.emit(GUESS_WHO_EVENTS.errorMsg, { message: 'Erreur serveur, réessaie.' });
    }
  }

  @SubscribeMessage(GUESS_WHO_EVENTS.joinRoom)
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code?: string },
  ): Promise<void> {
    try {
      this.dispatch(await this.service.joinRoom(body?.code ?? '', this.user(client)));
    } catch (err) {
      this.logger.error('Erreur onJoinRoom', err instanceof Error ? err.stack : String(err));
      client.emit(GUESS_WHO_EVENTS.errorMsg, { message: 'Erreur serveur, réessaie.' });
    }
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

  @SubscribeMessage(GUESS_WHO_EVENTS.endTurn)
  onEndTurn(@ConnectedSocket() client: Socket): void {
    this.dispatch(this.service.endTurn(client.id));
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

  @SubscribeMessage(GUESS_WHO_EVENTS.forfeit)
  onForfeit(@ConnectedSocket() client: Socket): void {
    this.dispatch(this.service.abandon(client.id));
  }
}
