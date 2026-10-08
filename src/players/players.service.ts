import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceChanged } from '../rooms/room.types';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async setPresence(userId: string, code: string, online: boolean): Promise<PresenceChanged> {
    const player = await this.prisma.player.findFirst({
      where: { userId, status: 'ACTIVE', room: { code } },
      select: { id: true },
    });
    if (!player) {
      const room = await this.prisma.room.findUnique({ where: { code }, select: { id: true } });
      if (!room) throw new NotFoundException('Room not found');
      throw new ForbiddenException('Join the crew first');
    }

    const updated = await this.prisma.player.update({
      where: { id: player.id },
      data: { isOnline: online, lastSeenAt: new Date() },
      select: { id: true, isOnline: true, lastSeenAt: true },
    });

    return {
      code,
      playerId: updated.id,
      userId,
      online: updated.isOnline,
      lastSeenAt: updated.lastSeenAt.toISOString(),
    };
  }

  // ponytail: presence is a Postgres flag — move to Redis when more than one server process runs.
  async markAllOffline(userId: string): Promise<PresenceChanged[]> {
    const rows = await this.prisma.player.findMany({
      where: { userId, status: 'ACTIVE', isOnline: true },
      select: { id: true, room: { select: { code: true } } },
    });
    if (!rows.length) return [];

    const lastSeenAt = new Date();
    await this.prisma.player.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { isOnline: false, lastSeenAt },
    });

    return rows.map((row) => ({
      code: row.room.code,
      playerId: row.id,
      userId,
      online: false,
      lastSeenAt: lastSeenAt.toISOString(),
    }));
  }
}
