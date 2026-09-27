import { Injectable, NotFoundException } from '@nestjs/common';
import { GameEventType, GameEventView, asRecord, toEventView } from '../common/game-events';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../websocket/realtime-bus';
import { RoomState, SharedRoomState, toInventoryView, toPublicPuzzle } from './room.types';

@Injectable()
export class RoomStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  async forUser(code: string, userId: string): Promise<RoomState> {
    const packed = await this.load(code);
    return { ...packed.shared, you: packed.inventoryByUserId[userId] ?? [] };
  }

  async publish(code: string, userId: string, fresh: GameEventView[] = []): Promise<RoomState> {
    const packed = await this.load(code);
    this.bus.emit({
      kind: 'state',
      code,
      shared: packed.shared,
      inventoryByUserId: packed.inventoryByUserId,
      fresh,
    });
    return { ...packed.shared, you: packed.inventoryByUserId[userId] ?? [] };
  }

  private async load(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: {
        players: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { username: true } },
            currentIsland: { select: { key: true } },
            inventory: true,
          },
          orderBy: { joinedAt: 'asc' },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 40 },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const [islands, solved, treasure] = await Promise.all([
      this.prisma.island.findMany({
        include: { puzzles: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      }),
      this.prisma.gameEvent.findMany({
        where: { roomId: room.id, type: GameEventType.PUZZLE_SOLVED },
        select: { playerId: true, payload: true },
      }),
      this.prisma.gameEvent.findFirst({
        where: { roomId: room.id, type: GameEventType.TREASURE_FOUND },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const inventoryByUserId: Record<string, RoomState['you']> = {};
    for (const player of room.players) {
      inventoryByUserId[player.userId] = player.inventory.map(toInventoryView);
    }

    const shared: SharedRoomState = {
      code: room.code,
      name: room.name,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      createdAt: room.createdAt.toISOString(),
      players: room.players.map((player) => ({
        id: player.id,
        userId: player.userId,
        username: player.user.username,
        isHost: player.isHost,
        isOnline: player.isOnline,
        isEliminated: player.isEliminated,
        strikes: player.strikes,
        lastSeenAt: player.lastSeenAt.toISOString(),
        currentIslandKey: player.currentIsland?.key ?? null,
      })),
      islands: islands.map((island) => ({
        id: island.id,
        key: island.key,
        name: island.name,
        description: island.description,
        x: island.x,
        y: island.y,
        order: island.order,
        kind: island.kind,
        puzzles: island.puzzles.map((puzzle) =>
          toPublicPuzzle({
            id: puzzle.id,
            key: puzzle.key,
            prompt: puzzle.prompt,
            cipher: puzzle.cipher,
            order: puzzle.order,
          }),
        ),
      })),
      progress: solved.flatMap((event) => {
        if (!event.playerId) return [];
        const puzzleKey = asRecord(event.payload).puzzleKey;
        return typeof puzzleKey === 'string' ? [{ playerId: event.playerId, puzzleKey }] : [];
      }),
      log: room.events.map(toEventView).reverse(),
      winnerPlayerId: treasure?.playerId ?? null,
    };

    return { shared, inventoryByUserId };
  }
}
