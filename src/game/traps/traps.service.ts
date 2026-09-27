import { Injectable } from '@nestjs/common';
import { applyStrike } from './traps';

@Injectable()
export class TrapsService {
  apply(strikes: number) {
    return applyStrike(strikes);
  }
}
