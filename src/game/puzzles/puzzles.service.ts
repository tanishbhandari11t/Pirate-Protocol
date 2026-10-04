import { Injectable } from '@nestjs/common';
import { Island, Prisma, Puzzle } from '@prisma/client';
import { GameEventType } from '../../common/game-events';
import { hashAnswer } from '../engine/answer';

type Tx = Prisma.TransactionClient;
type PuzzleWithIsland = Puzzle & { island: Island };

@Injectable()
export class PuzzleService {
  // ponytail: 8 seeded puzzles; restart after reseed.
  private readonly byKey = new Map<string, PuzzleWithIsland>();

  async findByKey(tx: Tx, key: string) {
    const hit = this.byKey.get(key);
    if (hit) return hit;
    const row = await tx.puzzle.findUnique({ where: { key }, include: { island: true } });
    if (row) this.byKey.set(key, row);
    return row;
  }

  async isSolved(tx: Tx, roomId: string, playerId: string, puzzleKey: string) {
    const existing = await tx.gameEvent.findFirst({
      where: {
        roomId,
        playerId,
        type: GameEventType.PUZZLE_SOLVED,
        payload: { path: ['puzzleKey'], equals: puzzleKey },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  grade(answer: string, answerHash: string, pepper: string) {
    return hashAnswer(answer, pepper) === answerHash;
  }
}
