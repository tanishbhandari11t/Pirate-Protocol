import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user';
import { CreateRoomDto, JoinRoomDto, PresenceDto } from './dto/room.dto';
import { RoomCodePipe } from './room-code.pipe';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user.userId, dto?.name);
  }

  @Post('join')
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinRoomDto) {
    return this.rooms.join(user.userId, dto.code);
  }

  @Post(':code/leave')
  @HttpCode(200)
  leave(@CurrentUser() user: AuthUser, @Param('code', RoomCodePipe) code: string) {
    return this.rooms.leave(user.userId, code);
  }

  @Get(':code')
  get(@CurrentUser() user: AuthUser, @Param('code', RoomCodePipe) code: string) {
    return this.rooms.get(user.userId, code);
  }

  @Post(':code/presence')
  @HttpCode(200)
  presence(
    @CurrentUser() user: AuthUser,
    @Param('code', RoomCodePipe) code: string,
    @Body() dto: PresenceDto,
  ) {
    return this.rooms.presence(user.userId, code, dto.online);
  }
}
