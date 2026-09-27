import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ROOM_CODE_PATTERN } from './room-code';

@Injectable()
export class RoomCodePipe implements PipeTransform<string, string> {
  transform(value: string) {
    const code = (value ?? '').trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(code)) throw new BadRequestException('Invalid room code');
    return code;
  }
}
