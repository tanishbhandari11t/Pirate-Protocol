import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GameEngine } from './engine/engine.service';
import { GameController } from './game.controller';
import { InventoryService } from './inventory/inventory.service';
import { MapService } from './map/map.service';
import { PuzzleService } from './puzzles/puzzles.service';
import { TradingService } from './trading/trading.service';
import { TrapsService } from './traps/traps.service';
import { TreasureService } from './treasure/treasure.service';

@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [GameController],
  providers: [
    GameEngine,
    MapService,
    PuzzleService,
    InventoryService,
    TradingService,
    TrapsService,
    TreasureService,
  ],
  exports: [GameEngine],
})
export class GameModule {}
