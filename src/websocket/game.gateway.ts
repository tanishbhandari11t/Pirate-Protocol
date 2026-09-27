import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { errorText } from '../common/error-text';
import { parseDto } from '../common/parse-dto';
import { GameEngine } from '../game/engine/engine.service';
import { PlayersService } from '../players/players.service';
import { CreateRoomDto } from '../rooms/dto/room.dto';
import { RoomsService } from '../rooms/rooms.service';
import { WsAnswerDto, WsJoinDto, WsLeaveDto, WsMoveDto, WsPresenceDto, WsTradeDto } from './dto';
import { ClientEvents, ServerEvents } from './events';
import { RealtimeBus } from './realtime-bus';

interface SocketData {
  userId?: string;
}

type GameSocket = Socket & { data: SocketData };

@WebSocketGateway({ cors: { origin: true } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameGateway.name);
  private readonly connections = new Map<string, number>();
  private unsubscribe?: () => void;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
    private readonly players: PlayersService,
    private readonly engine: GameEngine,
    private readonly bus: RealtimeBus,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.bus.subscribe((message) => {
      if (message.kind === 'presence') {
        this.server.to(this.channel(message.code)).emit(ServerEvents.PRESENCE, message.presence);
        return;
      }

      const members = this.server.sockets.adapter.rooms.get(this.channel(message.code));
      if (!members) return;
      for (const id of members) {
        const socket = this.server.sockets.sockets.get(id) as GameSocket | undefined;
        const userId = socket?.data.userId;
        if (!socket || !userId) continue;
        socket.emit(ServerEvents.STATE, {
          ...message.shared,
          you: message.inventoryByUserId[userId] ?? [],
        });
        for (const event of message.fresh) {
          socket.emit(ServerEvents.EVENT, { ...event, code: message.code });
        }
      }
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  async handleConnection(client: GameSocket) {
    try {
      const user = this.auth.verify(this.readToken(client));
      client.data.userId = user.userId;
      this.connections.set(user.userId, (this.connections.get(user.userId) ?? 0) + 1);
    } catch (error) {
      client.emit(ServerEvents.ERROR, { message: errorText(error) });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: GameSocket) {
    const userId = client.data.userId;
    if (!userId) return;
    const remaining = (this.connections.get(userId) ?? 1) - 1;
    if (remaining > 0) {
      this.connections.set(userId, remaining);
      return;
    }
    this.connections.delete(userId);
    try {
      const updates = await this.players.markAllOffline(userId);
      for (const presence of updates) {
        this.bus.emit({ kind: 'presence', code: presence.code, presence });
      }
    } catch (error) {
      this.logger.warn(errorText(error));
    }
  }

  @SubscribeMessage(ClientEvents.CREATE)
  create(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(CreateRoomDto, body ?? {});
      const state = await this.rooms.create(this.userId(client), dto.name);
      await client.join(this.channel(state.code));
      client.emit(ServerEvents.STATE, state);
      return state;
    });
  }

  @SubscribeMessage(ClientEvents.JOIN)
  join(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsJoinDto, body);
      await client.join(this.channel(dto.code));
      return this.rooms.join(this.userId(client), dto.code);
    });
  }

  @SubscribeMessage(ClientEvents.LEAVE)
  leave(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsLeaveDto, body);
      const result = await this.rooms.leave(this.userId(client), dto.code);
      await client.leave(this.channel(dto.code));
      return result;
    });
  }

  @SubscribeMessage(ClientEvents.PRESENCE)
  presence(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsPresenceDto, body);
      await client.join(this.channel(dto.code));
      return this.rooms.presence(this.userId(client), dto.code, dto.online);
    });
  }

  @SubscribeMessage(ClientEvents.MOVE)
  move(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsMoveDto, body);
      await client.join(this.channel(dto.code));
      return this.engine.move(this.userId(client), dto.code, dto.islandKey);
    });
  }

  @SubscribeMessage(ClientEvents.ANSWER)
  answer(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsAnswerDto, body);
      await client.join(this.channel(dto.code));
      return this.engine.submitAnswer(this.userId(client), dto.code, dto.puzzleKey, dto.answer);
    });
  }

  @SubscribeMessage(ClientEvents.TRADE)
  trade(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsTradeDto, body);
      await client.join(this.channel(dto.code));
      return this.engine.trade(this.userId(client), dto.code, dto.toPlayerId, dto.itemKey);
    });
  }

  private channel(code: string) {
    return `room:${code}`;
  }

  private userId(client: GameSocket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      throw new Error('Unauthorized');
    }
    return userId;
  }

  private readToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice('Bearer '.length);
    throw new Error('Unauthorized');
  }

  private async run<T>(client: GameSocket, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const message = errorText(error);
      this.logger.warn(message);
      client.emit(ServerEvents.ERROR, { message });
      throw new WsException(message);
    }
  }
}
