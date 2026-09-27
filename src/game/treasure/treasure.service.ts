import { BadRequestException, Injectable } from '@nestjs/common';
import { missingRelics } from './relics';

@Injectable()
export class TreasureService {
  missing(itemKeys: readonly string[]) {
    return missingRelics(itemKeys);
  }

  assertReady(itemKeys: readonly string[]) {
    const missing = this.missing(itemKeys);
    if (missing.length) {
      throw new BadRequestException(`Missing relics: ${missing.join(', ')}`);
    }
  }
}
