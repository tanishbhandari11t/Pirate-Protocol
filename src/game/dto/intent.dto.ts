import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MoveDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  islandKey!: string;
}

export class ExploreDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  islandKey!: string;
}

export class AnswerDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  puzzleKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  answer!: string;
}

export class TradeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  toPlayerId!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  itemKey!: string;
}
