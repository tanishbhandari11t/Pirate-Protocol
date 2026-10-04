import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './common/env';
import { GameModule } from './game/game.module';
import { HealthController } from './health.controller';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { LobbyModule } from './lobby/lobby.module';
import { RoomsModule } from './rooms/rooms.module';
import { RealtimeModule } from './websocket/realtime.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RealtimeModule,
    AuthModule,
    PlayersModule,
    RoomsModule,
    LobbyModule,
    GameModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
