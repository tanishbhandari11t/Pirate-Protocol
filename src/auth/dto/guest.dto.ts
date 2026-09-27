import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export class GuestDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @Matches(/^[a-z0-9_]{3,16}$/, { message: 'username must be 3-16 characters: a-z, 0-9, _' })
  username!: string;
}
