import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GameEventType, GameEventView, toEventView } from '../common/game-events';
import { isUniqueViolation } from '../common/prisma-errors';
import { PlayersService } from '../players/players.service';
import { PrismaService } from '../prisma/prisma.service';
import { START_ISLAND_KEY } from '../game/treasure/relics';
import { RealtimeBus } from '../websocket/realtime-bus';
import { makeRoomCode } from './room-code';
import { RoomState } from './room.types';
import { RoomStateService } from './room-state.service';

const MAX_CREW = 6;

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: RoomStateService,
    private readonly players: PlayersService,
    private readonly bus: RealtimeBus,
  ) {}

  async create(userId: string, name?: string): Promise<RoomState> {
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
          const start = await tx.island.findUnique({ where: { key: START_ISLAND_KEY } });
          const player = await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: true,
              isOnline: true,
              currentIslandId: start?.id,
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

  async join(userId: string, code: string) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { code } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status === 'FINISHED') throw new ConflictException('This hunt is over');

      const elsewhere = await tx.player.findFirst({
        where: { userId, status: 'ACTIVE', roomId: { not: room.id } },
        include: { room: { select: { code: true } } },
      });
      if (elsewhere) throw new ConflictException(`Leave crew ${elsewhere.room.code} first`);

      const existing = await tx.player.findUnique({
        where: { userId_roomId: { userId, roomId: room.id } },
      });
      if (existing?.status === 'ACTIVE') {
        await tx.player.update({
          where: { id: existing.id },
          data: { isOnline: true, lastSeenAt: new Date() },
        });
        return [] as GameEventView[];
      }

      const count = await tx.player.count({ where: { roomId: room.id, status: 'ACTIVE' } });
      if (count >= room.maxPlayers) throw new ConflictException('Crew is full');

      const start = await tx.island.findUnique({ where: { key: START_ISLAND_KEY } });
      const player = existing
        ? await tx.player.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              isOnline: true,
              lastSeenAt: new Date(),
              currentIslandId: existing.currentIslandId ?? start?.id,
            },
          })
        : await tx.player.create({
            data: {
              userId,
              roomId: room.id,
              isHost: false,
              isOnline: true,
              currentIslandId: start?.id,
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
      const room = await tx.room.findUnique({ where: { code } });
      if (!room) throw new NotFoundException('Room not found');
      const player = await tx.player.findUnique({
        where: { userId_roomId: { userId, roomId: room.id } },
      });
      if (!player || player.status !== 'ACTIVE') throw new ForbiddenException('You are not in this crew');

      await tx.player.update({
        where: { id: player.id },
        data: { status: 'LEFT', isOnline: false, lastSeenAt: new Date() },
      });
      const event = await tx.gameEvent.create({
        data: {
          roomId: room.id,
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
    await this.assertMember(userId, code);
    return this.state.forUser(code, userId);
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

  private async assertMember(userId: string, code: string) {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) throw new NotFoundException('Room not found');
    const player = await this.prisma.player.findFirst({
      where: { userId, roomId: room.id, status: 'ACTIVE' },
    });
    if (!player) throw new ForbiddenException('Join the crew first');
  }
}
