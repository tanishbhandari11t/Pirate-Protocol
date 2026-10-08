import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameModule } from '../game/game.module';
import { LobbyModule } from '../lobby/lobby.module';
import { PlayersModule } from '../players/players.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GameGateway } from './game.gateway';
import { RealtimeModule } from './realtime.module';

@Module({
  imports: [AuthModule, RoomsModule, PlayersModule, GameModule, LobbyModule, RealtimeModule],
  providers: [GameGateway],
})
export class WebsocketModule {}
