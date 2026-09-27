import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

@Injectable()
export class MapService {
  findByKey(tx: Tx, key: string) {
    return tx.island.findUnique({ where: { key } });
  }
}
