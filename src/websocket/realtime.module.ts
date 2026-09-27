import { Module } from '@nestjs/common';
import { RealtimeBus } from './realtime-bus';

@Module({
  providers: [RealtimeBus],
  exports: [RealtimeBus],
})
export class RealtimeModule {}
