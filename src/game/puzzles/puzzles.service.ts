import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GameEventType } from '../../common/game-events';
import { hashAnswer } from '../engine/answer';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PuzzleService {
  findByKey(tx: Tx, key: string) {
    return tx.puzzle.findUnique({ where: { key }, include: { island: true } });
  }

  async isSolved(tx: Tx, roomId: string, playerId: string, puzzleKey: string) {
    const existing = await tx.gameEvent.findFirst({
      where: {
        roomId,
        playerId,
        type: GameEventType.PUZZLE_SOLVED,
        payload: { path: ['puzzleKey'], equals: puzzleKey },
      },
    });
    return Boolean(existing);
  }

  grade(answer: string, answerHash: string, pepper: string) {
    return hashAnswer(answer, pepper) === answerHash;
  }
}
