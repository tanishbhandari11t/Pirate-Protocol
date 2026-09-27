import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { itemMeta } from './catalog';

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  async grant(tx: Tx, playerId: string, itemKey: string) {
    const meta = itemMeta(itemKey);
    if (!meta) throw new BadRequestException(`Unknown item: ${itemKey}`);
    await tx.inventory.upsert({
      where: { playerId_itemKey: { playerId, itemKey } },
      create: { playerId, itemKey, quantity: 1, metadata: meta },
      update: { quantity: { increment: 1 } },
    });
  }

  async transfer(tx: Tx, fromPlayerId: string, toPlayerId: string, itemKey: string, quantity: number) {
    const meta = itemMeta(itemKey);
    if (!meta) throw new BadRequestException(`Unknown item: ${itemKey}`);
    if (quantity <= 1) {
      await tx.inventory.delete({ where: { playerId_itemKey: { playerId: fromPlayerId, itemKey } } });
    } else {
      await tx.inventory.update({
        where: { playerId_itemKey: { playerId: fromPlayerId, itemKey } },
        data: { quantity: { decrement: 1 } },
      });
    }
    await tx.inventory.upsert({
      where: { playerId_itemKey: { playerId: toPlayerId, itemKey } },
      create: { playerId: toPlayerId, itemKey, quantity: 1, metadata: meta },
      update: { quantity: { increment: 1 } },
    });
  }
}
