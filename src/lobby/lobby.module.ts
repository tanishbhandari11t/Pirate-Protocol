import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { LobbyService } from './lobby.service';

@Module({
  imports: [AuthModule, forwardRef(() => RoomsModule), RealtimeModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
