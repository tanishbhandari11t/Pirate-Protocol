import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LobbyModule } from '../lobby/lobby.module';
import { PlayersModule } from '../players/players.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { RoomStateService } from './room-state.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuthModule, PlayersModule, RealtimeModule, forwardRef(() => LobbyModule)],
  controllers: [RoomsController],
  providers: [RoomsService, RoomStateService],
  exports: [RoomsService, RoomStateService],
})
export class RoomsModule {}
