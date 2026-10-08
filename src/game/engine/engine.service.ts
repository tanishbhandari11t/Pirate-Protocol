import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { GameEventType, GameEventView, asRecord, toEventView } from '../../common/game-events';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomStateService } from '../../rooms/room-state.service';
import { ISLAND_ARRIVAL_NOTICE, ISLAND_CLUE } from '../adventure/notices';
import { InventoryService } from '../inventory/inventory.service';
import { MapService } from '../map/map.service';
import { PuzzleService } from '../puzzles/puzzles.service';
import { TradingService } from '../trading/trading.service';
import { TrapsService } from '../traps/traps.service';
import { TreasureService } from '../treasure/treasure.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class GameEngine {
  private cachedPepper: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomStateService,
    private readonly config: ConfigService,
    private readonly map: MapService,
    private readonly puzzles: PuzzleService,
    private readonly inventory: InventoryService,
    private readonly trading: TradingService,
    private readonly traps: TrapsService,
    private readonly treasure: TreasureService,
  ) {}

  async move(userId: string, code: string, islandKey: string) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const player = await this.requirePlayer(tx, userId, code);
      this.assertPlayable(player.room.status);
      const fromKey = player.currentIsland?.key ?? null;
      this.map.assertTravel(fromKey, islandKey);
      if (fromKey === islandKey) return null;

      const island = await this.map.findByKey(tx, islandKey);
      if (!island) throw new NotFoundException('Island not found');

      await tx.player.update({
        where: { id: player.id },
        data: { currentIslandId: island.id, lastSeenAt: new Date() },
      });

      const events: GameEventView[] = [
        toEventView(
          await tx.gameEvent.create({
            data: {
              roomId: player.roomId,
              playerId: player.id,
              type: GameEventType.MOVED,
              payload: { islandKey: island.key, fromIslandKey: fromKey },
            },
          }),
        ),
      ];
      events.push(...(await this.recordIslandAdventure(tx, player.roomId, player.id, island.key)));
      return events;
    });
    if (!fresh) return this.rooms.forUser(code, userId);
    return this.rooms.publish(code, userId, fresh);
  }

  async explore(userId: string, code: string, islandKey: string) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const player = await this.requirePlayer(tx, userId, code);
      this.assertPlayable(player.room.status);
      if (player.currentIsland?.key !== islandKey) {
        throw new BadRequestException('You must be on that island to explore it');
      }
      return this.recordIslandAdventure(tx, player.roomId, player.id, islandKey, true);
    });
    return this.rooms.publish(code, userId, fresh);
  }

  async submitAnswer(userId: string, code: string, puzzleKey: string, answer: string) {
    const fresh = await this.prisma.$transaction(async (tx) => {
      const player = await this.requirePlayer(tx, userId, code);
      if (player.room.status === 'FINISHED') {
        throw new BadRequestException('The treasure has already been claimed');
      }
      this.assertPlayable(player.room.status);
      const puzzle = await this.puzzles.findByKey(tx, puzzleKey);
      if (!puzzle) throw new NotFoundException('Puzzle not found');
      if (await this.puzzles.isSolved(tx, player.roomId, player.id, puzzle.key)) {
        throw new ConflictException('Puzzle already solved');
      }

      if (puzzle.island.kind === 'TREASURE') {
        this.treasure.assertReady(player.inventory.map((item) => item.itemKey));
      }

      const correct = this.puzzles.grade(answer, puzzle.answerHash, this.pepper());
      if (!correct) return this.failPuzzle(tx, player, puzzle);

      const events: GameEventView[] = [];
      events.push(
        toEventView(
          await tx.gameEvent.create({
            data: {
              roomId: player.roomId,
              playerId: player.id,
              type: GameEventType.PUZZLE_SOLVED,
              payload: { puzzleKey: puzzle.key, islandKey: puzzle.island.key },
            },
          }),
        ),
      );

      if (puzzle.rewardKey) {
        await this.inventory.grant(tx, player.id, puzzle.rewardKey);
        events.push(await this.granted(tx, player.roomId, player.id, puzzle.rewardKey));
      }

      if (puzzle.island.kind === 'TREASURE') {
        await tx.room.update({ where: { id: player.roomId }, data: { status: 'FINISHED' } });
        events.push(
          toEventView(
            await tx.gameEvent.create({
              data: {
                roomId: player.roomId,
                playerId: player.id,
                type: GameEventType.TREASURE_FOUND,
                payload: { puzzleKey: puzzle.key },
              },
            }),
          ),
        );
      }

      return events;
    });
    return this.rooms.publish(code, userId, fresh);
  }

  async trade(userId: string, code: string, toPlayerId: string, itemKey: string) {
    this.trading.assertTradable(itemKey);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const sender = await this.requirePlayer(tx, userId, code);
      this.assertPlayable(sender.room.status);
      if (sender.id === toPlayerId) throw new BadRequestException('Choose another sailor');
      const recipient = await tx.player.findFirst({
        where: { id: toPlayerId, roomId: sender.roomId, status: 'ACTIVE' },
      });
      if (!recipient) throw new NotFoundException('That sailor is not in your crew');
      const stack = sender.inventory.find((item) => item.itemKey === itemKey);
      if (!stack || stack.quantity < 1) throw new BadRequestException('You do not hold that item');

      await this.inventory.transfer(tx, sender.id, recipient.id, itemKey, stack.quantity);
      const event = await tx.gameEvent.create({
        data: {
          roomId: sender.roomId,
          playerId: sender.id,
          type: GameEventType.TRADED,
          payload: { itemKey, fromPlayerId: sender.id, toPlayerId: recipient.id },
        },
      });
      return [toEventView(event)];
    });
    return this.rooms.publish(code, userId, fresh);
  }

  private async recordIslandAdventure(
    tx: Tx,
    roomId: string,
    playerId: string,
    islandKey: string,
    forceExplore = false,
  ): Promise<GameEventView[]> {
    const prior = await tx.gameEvent.findMany({
      where: {
        roomId,
        playerId,
        type: { in: [GameEventType.ISLAND_DISCOVERED, GameEventType.ISLAND_EXPLORED] },
      },
      select: { type: true, payload: true },
    });
    const hasDiscovered = prior.some(
      (e) => e.type === GameEventType.ISLAND_DISCOVERED && asRecord(e.payload).islandKey === islandKey,
    );
    const hasExplored = prior.some(
      (e) => e.type === GameEventType.ISLAND_EXPLORED && asRecord(e.payload).islandKey === islandKey,
    );

    const events: GameEventView[] = [];
    if (!hasDiscovered) {
      events.push(
        toEventView(
          await tx.gameEvent.create({
            data: {
              roomId,
              playerId,
              type: GameEventType.ISLAND_DISCOVERED,
              payload: { islandKey },
            },
          }),
        ),
      );
    }

    if (!hasExplored || forceExplore) {
      if (!hasExplored) {
        events.push(
          toEventView(
            await tx.gameEvent.create({
              data: {
                roomId,
                playerId,
                type: GameEventType.ISLAND_EXPLORED,
                payload: { islandKey },
              },
            }),
          ),
        );
      }
      const notice = ISLAND_ARRIVAL_NOTICE[islandKey];
      if (notice) {
        events.push(
          toEventView(
            await tx.gameEvent.create({
              data: {
                roomId,
                playerId,
                type: GameEventType.ADVENTURE_NOTICE,
                payload: { islandKey, text: notice },
              },
            }),
          ),
        );
      }
      const clue = ISLAND_CLUE[islandKey];
      if (clue && !hasExplored) {
        events.push(
          toEventView(
            await tx.gameEvent.create({
              data: {
                roomId,
                playerId,
                type: GameEventType.CLUE_FOUND,
                payload: { islandKey, text: clue },
              },
            }),
          ),
        );
      }
    }
    return events;
  }

  private async failPuzzle(
    tx: Tx,
    player: { id: string; roomId: string; strikes: number },
    puzzle: { key: string; trapOnFail: boolean },
  ): Promise<GameEventView[]> {
    if (!puzzle.trapOnFail) {
      const event = await tx.gameEvent.create({
        data: {
          roomId: player.roomId,
          playerId: player.id,
          type: GameEventType.PUZZLE_FAILED,
          payload: { puzzleKey: puzzle.key },
        },
      });
      return [toEventView(event)];
    }

    const next = this.traps.apply(player.strikes);
    await tx.player.update({
      where: { id: player.id },
      data: { strikes: next.strikes, isEliminated: next.isEliminated },
    });
    await this.inventory.grant(tx, player.id, 'cursed-coin');
    const trapped = await tx.gameEvent.create({
      data: {
        roomId: player.roomId,
        playerId: player.id,
        type: GameEventType.TRAP_TRIGGERED,
        payload: { puzzleKey: puzzle.key, strikes: next.strikes, eliminated: next.isEliminated },
      },
    });
    const granted = await this.granted(tx, player.roomId, player.id, 'cursed-coin');
    return [toEventView(trapped), granted];
  }

  private async granted(tx: Tx, roomId: string, playerId: string, itemKey: string) {
    return toEventView(
      await tx.gameEvent.create({
        data: {
          roomId,
          playerId,
          type: GameEventType.ITEM_GRANTED,
          payload: { itemKey },
        },
      }),
    );
  }

  private assertPlayable(status: string) {
    if (status !== 'ACTIVE') {
      throw new BadRequestException('The voyage has not begun yet');
    }
  }

  private pepper() {
    return (this.cachedPepper ??= this.config.getOrThrow<string>('APP_SECRET'));
  }

  private async requirePlayer(tx: Tx, userId: string, code: string) {
    const player = await tx.player.findFirst({
      where: { userId, status: 'ACTIVE', room: { code } },
      include: { room: true, inventory: true, currentIsland: { select: { key: true } } },
    });
    if (!player) {
      const room = await tx.room.findUnique({ where: { code }, select: { id: true } });
      if (!room) throw new NotFoundException('Room not found');
      throw new ForbiddenException('Join the crew first');
    }
    if (player.isEliminated) throw new ForbiddenException('A trap has taken you out of the hunt');
    return player;
  }
}
