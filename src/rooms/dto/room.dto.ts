import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ROOM_CODE_PATTERN } from '../room-code';

export class CreateRoomDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  name?: string;
}

export class JoinRoomDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(ROOM_CODE_PATTERN, { message: 'code must be a 6 character room code' })
  code!: string;
}

export class PresenceDto {
  @IsBoolean()
  online!: boolean;
}
