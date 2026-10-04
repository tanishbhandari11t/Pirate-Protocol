import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GameEventType, GameEventView, toEventView } from '../common/game-events';
import { isUniqueViolation } from '../common/prisma-errors';
import { PlayersService } from '../players/players.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStartIsland } from '../game/map/start-island';
import { RealtimeBus } from '../websocket/realtime-bus';
import { makeRoomCode } from './room-code';
import { RoomState } from './room.types';
import { RoomStateService } from './room-state.service';

const MAX_CREW = 6;

type SeatProfile = { displayName: string; avatarId: string };

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: RoomStateService,
    private readonly players: PlayersService,
    private readonly bus: RealtimeBus,
  ) {}

  /** Lobby path: seat only — no voyage `room:state` load. */
  async createWithProfile(
    userId: string,
    name: string,
    profile: SeatProfile,
  ): Promise<{ code: string; playerId: string }> {
    await this.assertNotInCrew(userId);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      try {
        const playerId = await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({
            data: {
              code,
              name: name?.trim() || `Crew ${code}`,
              hostId: userId,
              maxPlayers: MAX_CREW,
            },
          });
          const start = await resolveStartIsland(tx);
          const player = await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: true,
              isOnline: true,
              currentIslandId: start?.id,
              displayName: profile.displayName,
              avatarId: profile.avatarId,
            },
          });
          await tx.gameEvent.create({
            data: {
              roomId: room.id,
              playerId: player.id,
              type: GameEventType.PLAYER_JOINED,
              payload: { userId },
            },
          });
          return player.id;
        });
        this.logger.log(`Crew ${code} created`);
        return { code, playerId };
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }

    throw new ConflictException('Could not allocate a room code');
  }

  async joinWithProfile(
    userId: string,
    code: string,
    profile: SeatProfile,
  ): Promise<{ playerId: string }> {
    const playerId = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { code } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status === 'FINISHED') throw new ConflictException('This hunt is over');
      if (room.status !== 'LOBBY') throw new ConflictException('This hunt is already underway');

      const elsewhere = await tx.player.findFirst({
        where: { userId, status: 'ACTIVE', roomId: { not: room.id } },
        select: { room: { select: { code: true } } },
      });
      if (elsewhere) throw new ConflictException(`Leave crew ${elsewhere.room.code} first`);

      const existing = await tx.player.findUnique({
        where: { userId_roomId: { userId, roomId: room.id } },
      });
      if (existing?.status === 'ACTIVE') {
        await tx.player.update({
          where: { id: existing.id },
          data: {
            isOnline: true,
            lastSeenAt: new Date(),
            displayName: profile.displayName,
            avatarId: profile.avatarId,
          },
        });
        return existing.id;
      }

      const count = await tx.player.count({ where: { roomId: room.id, status: 'ACTIVE' } });
      if (count >= room.maxPlayers) throw new ConflictException('Crew is full');

      const start = await resolveStartIsland(tx);
      const player = existing
        ? await tx.player.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              isOnline: true,
              lastSeenAt: new Date(),
              currentIslandId: existing.currentIslandId ?? start?.id,
              displayName: profile.displayName,
              avatarId: profile.avatarId,
            },
          })
        : await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: false,
              isOnline: true,
              currentIslandId: start?.id,
              displayName: profile.displayName,
              avatarId: profile.avatarId,
            },
          });

      await tx.gameEvent.create({
        data: {
          roomId: room.id,
          playerId: player.id,
          type: GameEventType.PLAYER_JOINED,
          payload: { userId },
        },
      });
      return player.id;
    });
    return { playerId };
  }

  async create(userId: string, name?: string, profile?: SeatProfile): Promise<RoomState> {
    await this.assertNotInCrew(userId);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      try {
        const fresh = await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({
            data: {
              code,
              name: name?.trim() || `Crew ${code}`,
              hostId: userId,
              maxPlayers: MAX_CREW,
            },
          });
          const start = await resolveStartIsland(tx);
          const player = await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: true,
              isOnline: true,
              currentIslandId: start?.id,
              displayName: profile?.displayName,
              avatarId: profile?.avatarId,
            },
          });
          const event = await tx.gameEvent.create({
            data: {
              roomId: room.id,
              playerId: player.id,
              type: GameEventType.PLAYER_JOINED,
              payload: { userId },
            },
          });
          return [toEventView(event)];
        });
        this.logger.log(`Crew ${code} created`);
        return this.state.publish(code, userId, fresh);
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }

    throw new ConflictException('Could not allocate a room code');
  }

  async join(userId: string, code: string, profile?: SeatProfile) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { code } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status === 'FINISHED') throw new ConflictException('This hunt is over');
      if (room.status !== 'LOBBY') throw new ConflictException('This hunt is already underway');

      const elsewhere = await tx.player.findFirst({
        where: { userId, status: 'ACTIVE', roomId: { not: room.id } },
        select: { room: { select: { code: true } } },
      });
      if (elsewhere) throw new ConflictException(`Leave crew ${elsewhere.room.code} first`);

      const existing = await tx.player.findUnique({
        where: { userId_roomId: { userId, roomId: room.id } },
      });
      if (existing?.status === 'ACTIVE') {
        await tx.player.update({
          where: { id: existing.id },
          data: {
            isOnline: true,
            lastSeenAt: new Date(),
            displayName: profile?.displayName ?? existing.displayName,
            avatarId: profile?.avatarId ?? existing.avatarId,
          },
        });
        return [] as GameEventView[];
      }

      const count = await tx.player.count({ where: { roomId: room.id, status: 'ACTIVE' } });
      if (count >= room.maxPlayers) throw new ConflictException('Crew is full');

      const start = await resolveStartIsland(tx);
      const player = existing
        ? await tx.player.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              isOnline: true,
              lastSeenAt: new Date(),
              currentIslandId: existing.currentIslandId ?? start?.id,
              displayName: profile?.displayName ?? existing.displayName,
              avatarId: profile?.avatarId ?? existing.avatarId,
            },
          })
        : await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: false,
              isOnline: true,
              currentIslandId: start?.id,
              displayName: profile?.displayName,
              avatarId: profile?.avatarId,
            },
          });

      const event = await tx.gameEvent.create({
        data: {
          roomId: room.id,
          playerId: player.id,
          type: GameEventType.PLAYER_JOINED,
          payload: { userId },
        },
      });
      return [toEventView(event)];
    });

    return this.state.publish(code, userId, fresh);
  }

  async leave(userId: string, code: string) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findFirst({
        where: { userId, status: 'ACTIVE', room: { code } },
        select: { id: true, roomId: true },
      });
      if (!player) {
        const room = await tx.room.findUnique({ where: { code }, select: { id: true } });
        if (!room) throw new NotFoundException('Room not found');
        throw new ForbiddenException('You are not in this crew');
      }

      await tx.player.update({
        where: { id: player.id },
        data: { status: 'LEFT', isOnline: false, lastSeenAt: new Date() },
      });
      const event = await tx.gameEvent.create({
        data: {
          roomId: player.roomId,
          playerId: player.id,
          type: GameEventType.PLAYER_LEFT,
          payload: { userId },
        },
      });
      return [toEventView(event)];
    });

    await this.state.publish(code, userId, fresh);
    return { left: true as const };
  }

  async get(userId: string, code: string) {
    const state = await this.state.forUser(code, userId);
    if (!state.players.some((player) => player.userId === userId)) {
      throw new ForbiddenException('Join the crew first');
    }
    return state;
  }

  async presence(userId: string, code: string, online: boolean) {
    const presence = await this.players.setPresence(userId, code, online);
    this.bus.emit({ kind: 'presence', code, presence });
    return { online: presence.online, lastSeenAt: presence.lastSeenAt };
  }

  private async assertNotInCrew(userId: string) {
    const elsewhere = await this.prisma.player.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { room: { select: { code: true } } },
    });
    if (elsewhere) throw new ConflictException(`Leave crew ${elsewhere.room.code} first`);
  }

}
