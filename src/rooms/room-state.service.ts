import { Injectable, NotFoundException } from '@nestjs/common';
import { GameEventType, GameEventView, asRecord, toEventView } from '../common/game-events';
import { destinationsFrom } from '../game/map/routes';
import { ROOM_META_EVENT_TYPES, scoreFromEvents } from '../game/score';
import { missingRelics } from '../game/treasure/relics';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../websocket/realtime-bus';
import {
  ActiveClue,
  LobbyRoomSnapshot,
  PublicIsland,
  RoomState,
  SharedRoomState,
  lobbyPhaseFromStatus,
  roomPhaseFromStatus,
  toInventoryView,
  toPublicPuzzle,
} from './room.types';

type PackedRoom = {
  shared: SharedRoomState;
  inventoryByUserId: Record<string, RoomState['you']>;
  vaultByUserId: Record<string, RoomState['vault']>;
};

@Injectable()
export class RoomStateService {
  // ponytail: one process-wide copy of the map. Restart after reseed.
  private catalogLoad: Promise<PublicIsland[]> | null = null;
  // Short TTL so concurrent GETs after a publish don't re-hit Postgres.
  private readonly packedCache = new Map<string, { at: number; packed: PackedRoom }>();
  private static readonly PACKED_TTL_MS = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  async forUser(code: string, userId: string): Promise<RoomState> {
    const packed = await this.load(code);
    return this.viewFor(packed, userId);
  }

  async publish(code: string, userId: string, fresh: GameEventView[] = []): Promise<RoomState> {
    this.packedCache.delete(code);
    const packed = await this.load(code);
    this.bus.emit({
      kind: 'state',
      code,
      shared: packed.shared,
      inventoryByUserId: packed.inventoryByUserId,
      vaultByUserId: packed.vaultByUserId,
      fresh,
    });
    return this.viewFor(packed, userId);
  }

  private viewFor(packed: PackedRoom, userId: string): RoomState {
    const islandKey =
      packed.shared.players.find((p) => p.userId === userId)?.currentIslandKey ?? null;
    return {
      ...packed.shared,
      destinations: destinationsFrom(islandKey),
      you: packed.inventoryByUserId[userId] ?? [],
      vault: packed.vaultByUserId[userId] ?? { ready: false, missingRelics: [] },
    };
  }

  async lobbySnapshot(code: string): Promise<LobbyRoomSnapshot> {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: {
        players: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    const captain = room.players.find((p) => p.isHost) ?? room.players[0];
    return {
      code: room.code,
      crewName: room.name,
      phase: lobbyPhaseFromStatus(room.status),
      captainId: captain?.id ?? room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.displayName ?? p.id,
        avatarId: p.avatarId,
        isCaptain: p.isHost,
        isReady: p.isReady,
        isConnected: p.isOnline,
        joinedAt: p.joinedAt.toISOString(),
      })),
      maxPlayers: room.maxPlayers,
      minPlayers: 2,
      createdAt: room.createdAt.toISOString(),
      countdownEndsAt: room.countdownEndsAt?.toISOString() ?? null,
    };
  }

  publishLobby(code: string, snapshot?: LobbyRoomSnapshot) {
    if (snapshot) {
      this.bus.emit({ kind: 'lobby', code, snapshot });
      return;
    }
    void this.lobbySnapshot(code).then((loaded) => {
      this.bus.emit({ kind: 'lobby', code, snapshot: loaded });
    });
  }

  private async load(code: string): Promise<PackedRoom> {
    const cached = this.packedCache.get(code);
    if (cached && Date.now() - cached.at < RoomStateService.PACKED_TTL_MS) {
      return cached.packed;
    }

    const room = await this.prisma.room.findUnique({
      where: { code },
      include: {
        players: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { username: true } },
            currentIsland: { select: { key: true } },
            inventory: { select: { itemKey: true, quantity: true, metadata: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    // Log = newest 40 of everything. Meta = scoring/progress/discovery only (skips MOVED spam).
    const eventSelect = { id: true, type: true, payload: true, playerId: true, createdAt: true } as const;
    const [islands, logRows, meta] = await Promise.all([
      this.catalog(),
      this.prisma.gameEvent.findMany({
        where: { roomId: room.id },
        select: eventSelect,
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.gameEvent.findMany({
        where: { roomId: room.id, type: { in: [...ROOM_META_EVENT_TYPES] } },
        select: eventSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const discoveredIslandKeys: string[] = [];
    const exploredIslandKeys: string[] = [];
    const discoveredSet = new Set<string>();
    const exploredSet = new Set<string>();
    const activeClues: ActiveClue[] = [];
    const progress: SharedRoomState['progress'] = [];
    let winnerPlayerId: string | null = null;

    for (const event of meta) {
      if (event.type === GameEventType.TREASURE_FOUND && !winnerPlayerId) {
        winnerPlayerId = event.playerId;
      } else if (event.type === GameEventType.PUZZLE_SOLVED && event.playerId) {
        const puzzleKey = asRecord(event.payload).puzzleKey;
        if (typeof puzzleKey === 'string') progress.push({ playerId: event.playerId, puzzleKey });
      } else if (event.type === GameEventType.ISLAND_DISCOVERED) {
        const islandKey = asRecord(event.payload).islandKey;
        if (typeof islandKey === 'string' && !discoveredSet.has(islandKey)) {
          discoveredSet.add(islandKey);
          discoveredIslandKeys.push(islandKey);
        }
      } else if (event.type === GameEventType.ISLAND_EXPLORED) {
        const islandKey = asRecord(event.payload).islandKey;
        if (typeof islandKey === 'string' && !exploredSet.has(islandKey)) {
          exploredSet.add(islandKey);
          exploredIslandKeys.push(islandKey);
        }
      } else if (event.type === GameEventType.CLUE_FOUND) {
        const payload = asRecord(event.payload);
        activeClues.push({
          id: event.id,
          text: typeof payload.text === 'string' ? payload.text : '',
          islandKey: typeof payload.islandKey === 'string' ? payload.islandKey : undefined,
        });
      }
    }

    discoveredIslandKeys.reverse();
    exploredIslandKeys.reverse();
    activeClues.reverse();
    progress.reverse();

    const inventoryByUserId: Record<string, RoomState['you']> = {};
    const vaultByUserId: Record<string, RoomState['vault']> = {};
    for (const player of room.players) {
      inventoryByUserId[player.userId] = player.inventory.map(toInventoryView);
      const keys = player.inventory.map((i) => i.itemKey);
      const missing = missingRelics(keys);
      vaultByUserId[player.userId] = { ready: missing.length === 0, missingRelics: [...missing] };
    }

    const shared: SharedRoomState = {
      code: room.code,
      name: room.name,
      status: room.status,
      phase: roomPhaseFromStatus(room.status),
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      createdAt: room.createdAt.toISOString(),
      countdownEndsAt: room.countdownEndsAt?.toISOString() ?? null,
      voyageStartedAt: room.voyageStartedAt?.toISOString() ?? null,
      players: room.players.map((player) => ({
        id: player.id,
        userId: player.userId,
        username: player.user.username,
        displayName: player.displayName ?? player.user.username,
        avatarId: player.avatarId,
        isHost: player.isHost,
        isReady: player.isReady,
        isOnline: player.isOnline,
        isEliminated: player.isEliminated,
        strikes: player.strikes,
        lastSeenAt: player.lastSeenAt.toISOString(),
        currentIslandKey: player.currentIsland?.key ?? null,
      })),
      islands,
      discoveredIslandKeys,
      exploredIslandKeys,
      activeClues,
      scores: scoreFromEvents(meta),
      // Filled per viewer in viewFor / gateway — avoid broadcasting the actor's chart.
      destinations: [],
      progress,
      log: logRows.map(toEventView).reverse(),
      winnerPlayerId,
    };

    const packed = { shared, inventoryByUserId, vaultByUserId };
    this.packedCache.set(code, { at: Date.now(), packed });
    return packed;
  }

  private catalog() {
    if (!this.catalogLoad) {
      this.catalogLoad = this.prisma.island
        .findMany({
          orderBy: { order: 'asc' },
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            x: true,
            y: true,
            order: true,
            kind: true,
            puzzles: {
              orderBy: { order: 'asc' },
              select: { id: true, key: true, prompt: true, cipher: true, order: true },
            },
          },
        })
        .then((rows) => rows.map((island) => ({ ...island, puzzles: island.puzzles.map(toPublicPuzzle) })))
        .catch((error: unknown) => {
          this.catalogLoad = null;
          throw error;
        });
    }
    return this.catalogLoad;
  }

}
