import { BadRequestException, Injectable } from '@nestjs/common';
import { Island, Prisma } from '@prisma/client';
import { canTravel, destinationsFrom } from './routes';

type Tx = Prisma.TransactionClient;

@Injectable()
export class MapService {
  // ponytail: 8 seeded islands; restart after reseed.
  private readonly byKey = new Map<string, Island>();

  async findByKey(tx: Tx, key: string) {
    const hit = this.byKey.get(key);
    if (hit) return hit;
    const row = await tx.island.findUnique({ where: { key } });
    if (row) this.byKey.set(key, row);
    return row;
  }

  assertTravel(fromKey: string | null | undefined, toKey: string) {
    if (!canTravel(fromKey, toKey)) {
      throw new BadRequestException('That route is not on your chart');
    }
  }

  destinations(fromKey: string | null | undefined) {
    return destinationsFrom(fromKey);
  }
}
