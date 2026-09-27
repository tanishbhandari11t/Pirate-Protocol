import { Injectable } from '@nestjs/common';
import { InventoryView, PresenceChanged, RoomState, SharedRoomState } from '../rooms/room.types';

export type RealtimeMessage =
  | {
      kind: 'state';
      code: string;
      shared: SharedRoomState;
      inventoryByUserId: Record<string, InventoryView[]>;
      fresh: RoomState['log'];
    }
  | { kind: 'presence'; code: string; presence: PresenceChanged };

type Listener = (message: RealtimeMessage) => void;

@Injectable()
export class RealtimeBus {
  private readonly listeners = new Set<Listener>();

  emit(message: RealtimeMessage) {
    for (const listener of this.listeners) listener(message);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
