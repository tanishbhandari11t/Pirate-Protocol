import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ROOM_CODE_PATTERN } from '../rooms/room-code';

class RoomCodeDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(ROOM_CODE_PATTERN, { message: 'code must be a 6 character room code' })
  code!: string;
}

export class WsJoinDto extends RoomCodeDto {}

export class WsLeaveDto extends RoomCodeDto {}

export class WsPresenceDto extends RoomCodeDto {
  @IsBoolean()
  online!: boolean;
}

export class WsMoveDto extends RoomCodeDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  islandKey!: string;
}

export class WsExploreDto extends RoomCodeDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  islandKey!: string;
}

export class WsAnswerDto extends RoomCodeDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  puzzleKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  answer!: string;
}

export class WsTradeDto extends RoomCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  toPlayerId!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  itemKey!: string;
}
