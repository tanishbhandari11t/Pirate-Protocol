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
import { destinationsFrom } from '../game/map/routes';
import { LOBBY_AVATARS } from '../lobby/lobby.constants';
import { LobbyService } from '../lobby/lobby.service';
import { ackFail } from '../lobby/lobby.types';
import { PlayersService } from '../players/players.service';
import { CreateRoomDto } from '../rooms/dto/room.dto';
import { RoomsService } from '../rooms/rooms.service';
import { WsAnswerDto, WsExploreDto, WsJoinDto, WsLeaveDto, WsMoveDto, WsPresenceDto, WsTradeDto } from './dto';
import { aliasesFor } from './event-aliases';
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
    private readonly lobby: LobbyService,
    private readonly bus: RealtimeBus,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.bus.subscribe((message) => {
      const room = this.channel(message.code);
      if (message.kind === 'presence') {
        this.server.to(room).emit(ServerEvents.PRESENCE, message.presence);
        return;
      }
      if (message.kind === 'lobby') {
        this.server.to(room).emit(ServerEvents.STATE, message.snapshot);
        return;
      }
      if (message.kind === 'notice') {
        this.server.to(room).emit(ServerEvents.NOTICE, { message: message.message, code: message.code });
        return;
      }
      if (message.kind === 'alias') {
        this.server.to(room).emit(message.event, message.payload);
        return;
      }

      // Room-wide events once; you / vault / destinations stay per-socket.
      for (const event of message.fresh) {
        this.server.to(room).emit(ServerEvents.EVENT, { ...event, code: message.code });
        for (const alias of aliasesFor(event, message.code)) {
          this.server.to(room).emit(alias.event, alias.payload);
        }
      }

      const members = this.server.sockets.adapter.rooms.get(room);
      if (!members) return;
      for (const id of members) {
        const socket = this.server.sockets.sockets.get(id) as GameSocket | undefined;
        const userId = socket?.data.userId;
        if (!socket || !userId) continue;
        const islandKey =
          message.shared.players.find((p) => p.userId === userId)?.currentIslandKey ?? null;
        socket.emit(ServerEvents.STATE, {
          ...message.shared,
          destinations: destinationsFrom(islandKey),
          you: message.inventoryByUserId[userId] ?? [],
          vault: message.vaultByUserId[userId] ?? { ready: false, missingRelics: [] },
        });
      }
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  async handleConnection(client: GameSocket) {
    const token = this.readTokenOptional(client);
    if (!token) return;
    try {
      const user = this.auth.verify(token);
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

  @SubscribeMessage(ClientEvents.CREW_CREATE)
  async crewCreate(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    const payload = body as { playerName?: string; crewName?: string; avatarId?: string };
    if (!payload?.playerName || !payload?.crewName || !payload?.avatarId || !LOBBY_AVATARS.has(payload.avatarId)) {
      return ackFail('INVALID_PAYLOAD');
    }
    const result = await this.lobby.createCrew(payload.playerName, payload.crewName, payload.avatarId);
    if (result.ok) {
      client.data.userId = result.data.userId;
      this.connections.set(result.data.userId, (this.connections.get(result.data.userId) ?? 0) + 1);
      await client.join(this.channel(result.data.room.code));
    }
    return result;
  }

  @SubscribeMessage(ClientEvents.CREW_JOIN)
  async crewJoin(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    const payload = body as { playerName?: string; roomCode?: string; avatarId?: string };
    if (!payload?.playerName || !payload?.roomCode || !payload?.avatarId || !LOBBY_AVATARS.has(payload.avatarId)) {
      return ackFail('INVALID_PAYLOAD');
    }
    const result = await this.lobby.joinCrew(payload.playerName, payload.roomCode, payload.avatarId);
    if (result.ok) {
      client.data.userId = result.data.userId;
      this.connections.set(result.data.userId, (this.connections.get(result.data.userId) ?? 0) + 1);
      await client.join(this.channel(result.data.room.code));
    }
    return result;
  }

  @SubscribeMessage(ClientEvents.CREW_LEAVE)
  crewLeave(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const payload = body as { roomCode?: string; code?: string };
      const code = String(payload?.roomCode ?? payload?.code ?? '').toUpperCase();
      return this.lobby.leaveCrew(this.userId(client), code);
    });
  }

  @SubscribeMessage(ClientEvents.CREW_READY)
  crewReady(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const payload = body as { roomCode?: string; code?: string; ready?: boolean };
      const code = String(payload?.roomCode ?? payload?.code ?? '').toUpperCase();
      return this.lobby.setReady(this.userId(client), code, Boolean(payload?.ready));
    });
  }

  @SubscribeMessage(ClientEvents.CREW_START)
  crewStart(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const payload = body as { roomCode?: string; code?: string };
      const code = String(payload?.roomCode ?? payload?.code ?? '').toUpperCase();
      return this.lobby.startVoyage(this.userId(client), code);
    });
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

  @SubscribeMessage(ClientEvents.EXPLORE)
  explore(@ConnectedSocket() client: GameSocket, @MessageBody() body: unknown) {
    return this.run(client, async () => {
      const dto = await parseDto(WsExploreDto, body);
      await client.join(this.channel(dto.code));
      return this.engine.explore(this.userId(client), dto.code, dto.islandKey);
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
      throw new WsException('Unauthorized');
    }
    return userId;
  }

  private readTokenOptional(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice('Bearer '.length);
    return null;
  }

  private async run<T>(client: GameSocket, work: () => Promise<T>): Promise<T> {
    try {
      if (!client.data.userId) {
        const token = this.readTokenOptional(client);
        if (token) client.data.userId = this.auth.verify(token).userId;
      }
      return await work();
    } catch (error) {
      const message = errorText(error);
      this.logger.warn(message);
      client.emit(ServerEvents.ERROR, { message });
      throw new WsException(message);
    }
  }
}
