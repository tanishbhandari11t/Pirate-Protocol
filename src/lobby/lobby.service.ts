import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GameEventType } from '../common/game-events';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStartIsland } from '../game/map/start-island';
import { RoomStateService } from '../rooms/room-state.service';
import { RoomsService } from '../rooms/rooms.service';
import { RealtimeBus } from '../websocket/realtime-bus';
import { COUNTDOWN_SECONDS, LOBBY_AVATARS, MIN_CREW_READY } from './lobby.constants';
import { Ack, ackFail, ackOk } from './lobby.types';
import { makeGuestUsername } from './lobby.util';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly countdowns = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
    private readonly state: RoomStateService,
    private readonly bus: RealtimeBus,
  ) {}

  async createCrew(playerName: string, crewName: string, avatarId: string): Promise<
    Ack<{
      token: string;
      expiresAt: string;
      room: Awaited<ReturnType<RoomStateService['lobbySnapshot']>>;
      playerId: string;
      userId: string;
    }>
  > {
    if (!LOBBY_AVATARS.has(avatarId)) return ackFail('INVALID_PAYLOAD');
    const username = makeGuestUsername(playerName);
    const session = await this.auth.guest(username);
    const seated = await this.rooms.createWithProfile(session.user.id, crewName, {
      displayName: playerName.trim(),
      avatarId,
    });
    const snapshot = await this.state.lobbySnapshot(seated.code);
    this.state.publishLobby(seated.code, snapshot);
    return ackOk({
      token: session.token,
      expiresAt: session.expiresAt,
      room: snapshot,
      playerId: seated.playerId,
      userId: session.user.id,
    });
  }

  async joinCrew(
    playerName: string,
    roomCode: string,
    avatarId: string,
  ): Promise<
    Ack<{
      token: string;
      expiresAt: string;
      room: Awaited<ReturnType<RoomStateService['lobbySnapshot']>>;
      playerId: string;
      userId: string;
    }>
  > {
    if (!LOBBY_AVATARS.has(avatarId)) return ackFail('INVALID_PAYLOAD');
    const code = roomCode.trim().toUpperCase();
    const room = await this.prisma.room.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!room) return ackFail('ROOM_NOT_FOUND');
    if (room.status !== 'LOBBY') return ackFail('GAME_IN_PROGRESS');

    const username = makeGuestUsername(playerName);
    const session = await this.auth.guest(username);
    try {
      const seated = await this.rooms.joinWithProfile(session.user.id, code, {
        displayName: playerName.trim(),
        avatarId,
      });
      const snapshot = await this.state.lobbySnapshot(code);
      this.state.publishLobby(code, snapshot);
      return ackOk({
        token: session.token,
        expiresAt: session.expiresAt,
        room: snapshot,
        playerId: seated.playerId,
        userId: session.user.id,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        const msg = error.message;
        if (msg.includes('full')) return ackFail('ROOM_FULL');
        if (msg.includes('over')) return ackFail('GAME_IN_PROGRESS');
        return ackFail('INVALID_PAYLOAD', msg);
      }
      throw error;
    }
  }

  async setReady(userId: string, code: string, ready: boolean) {
    const updated = await this.prisma.player.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        room: { code, status: { in: ['LOBBY', 'COUNTDOWN'] } },
      },
      data: { isReady: ready },
    });
    if (updated.count === 0) {
      const room = await this.prisma.room.findUnique({ where: { code }, select: { status: true } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status !== 'LOBBY' && room.status !== 'COUNTDOWN') {
        throw new ConflictException('This hunt is already underway');
      }
      throw new ForbiddenException('Join the crew first');
    }
    this.state.publishLobby(code);
    return ackOk({ ready });
  }

  async startVoyage(userId: string, code: string): Promise<Ack<{ countdownSeconds: number }>> {
    const room = await this.requireLobbyRoom(code);
    if (room.hostId !== userId) return ackFail('NOT_CAPTAIN');
    const readyCount = await this.prisma.player.count({
      where: { roomId: room.id, status: 'ACTIVE', isReady: true },
    });
    if (readyCount < MIN_CREW_READY) return ackFail('NOT_READY', `Need ${MIN_CREW_READY} sailors ready`);

    const endsAt = new Date(Date.now() + COUNTDOWN_SECONDS * 1000);
    await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'COUNTDOWN', countdownEndsAt: endsAt },
    });
    const snapshot = await this.state.lobbySnapshot(code);
    this.state.publishLobby(code, snapshot);
    this.bus.emit({ kind: 'alias', code, event: 'game:starting', payload: { code, countdownSeconds: COUNTDOWN_SECONDS } });
    this.bus.emit({ kind: 'notice', code, message: 'The captain orders sail. Hold fast.' });
    this.scheduleCountdown(code, room.id);
    return ackOk({ countdownSeconds: COUNTDOWN_SECONDS });
  }

  async leaveCrew(userId: string, code: string) {
    await this.rooms.leave(userId, code);
    this.state.publishLobby(code);
    return ackOk({ left: true });
  }

  cancelCountdown(code: string) {
    const timer = this.countdowns.get(code);
    if (timer) {
      clearTimeout(timer);
      this.countdowns.delete(code);
    }
  }

  private scheduleCountdown(code: string, roomId: string) {
    this.cancelCountdown(code);
    const timer = setTimeout(() => {
      void this.finishCountdown(code, roomId);
    }, COUNTDOWN_SECONDS * 1000);
    this.countdowns.set(code, timer);
  }

  private async finishCountdown(code: string, roomId: string) {
    this.countdowns.delete(code);
    const now = new Date();
    const hostId = await this.prisma.$transaction(async (tx) => {
      const start = await resolveStartIsland(tx);
      const room = await tx.room.update({
        where: { id: roomId },
        data: { status: 'ACTIVE', voyageStartedAt: now, countdownEndsAt: null },
        select: { hostId: true },
      });
      const players = await tx.player.findMany({
        where: { roomId, status: 'ACTIVE' },
        select: { id: true },
      });
      await tx.player.updateMany({
        where: { roomId, status: 'ACTIVE' },
        data: { isReady: false },
      });
      if (start) {
        await tx.player.updateMany({
          where: { roomId, status: 'ACTIVE', currentIslandId: null },
          data: { currentIslandId: start.id },
        });
      }
      await tx.gameEvent.create({
        data: {
          roomId,
          type: GameEventType.VOYAGE_STARTED,
          payload: { at: now.toISOString() },
        },
      });
      if (start && players.length) {
        await tx.gameEvent.createMany({
          data: players.map((player) => ({
            roomId,
            playerId: player.id,
            type: GameEventType.ISLAND_DISCOVERED,
            payload: { islandKey: start.key },
          })),
        });
      }
      return room.hostId;
    });
    this.bus.emit({ kind: 'alias', code, event: 'game:started', payload: { code } });
    this.logger.log(`Voyage ${code} started`);
    await this.state.publish(code, hostId, []);
  }

  private async requireLobbyRoom(code: string) {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'LOBBY' && room.status !== 'COUNTDOWN') {
      throw new ConflictException('This hunt is already underway');
    }
    return room;
  }

}
