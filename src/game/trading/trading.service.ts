import { BadRequestException, Injectable } from '@nestjs/common';
import { TRADABLE_ITEMS } from '../treasure/relics';

@Injectable()
export class TradingService {
  assertTradable(itemKey: string) {
    if (!(TRADABLE_ITEMS as readonly string[]).includes(itemKey)) {
      throw new BadRequestException('That item cannot be traded');
    }
  }
}
