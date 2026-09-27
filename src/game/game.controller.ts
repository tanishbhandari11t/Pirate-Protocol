import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user';
import { RoomCodePipe } from '../rooms/room-code.pipe';
import { AnswerDto, MoveDto, TradeDto } from './dto/intent.dto';
import { GameEngine } from './engine/engine.service';

@Controller('rooms')
@UseGuards(AuthGuard)
export class GameController {
  constructor(private readonly engine: GameEngine) {}

  @Post(':code/move')
  @HttpCode(200)
  move(@CurrentUser() user: AuthUser, @Param('code', RoomCodePipe) code: string, @Body() dto: MoveDto) {
    return this.engine.move(user.userId, code, dto.islandKey);
  }

  @Post(':code/answer')
  @HttpCode(200)
  answer(@CurrentUser() user: AuthUser, @Param('code', RoomCodePipe) code: string, @Body() dto: AnswerDto) {
    return this.engine.submitAnswer(user.userId, code, dto.puzzleKey, dto.answer);
  }

  @Post(':code/trade')
  @HttpCode(200)
  trade(@CurrentUser() user: AuthUser, @Param('code', RoomCodePipe) code: string, @Body() dto: TradeDto) {
    return this.engine.trade(user.userId, code, dto.toPlayerId, dto.itemKey);
  }
}
