import { Injectable } from '@nestjs/common';
import { GameEventView } from '../common/game-events';
import { InventoryView, LobbyRoomSnapshot, PresenceChanged, RoomState, SharedRoomState, VaultSummary } from '../rooms/room.types';

export type RealtimeMessage =
  | {
      kind: 'state';
      code: string;
      shared: SharedRoomState;
      inventoryByUserId: Record<string, InventoryView[]>;
      vaultByUserId: Record<string, VaultSummary>;
      fresh: RoomState['log'];
    }
  | { kind: 'lobby'; code: string; snapshot: LobbyRoomSnapshot }
  | { kind: 'presence'; code: string; presence: PresenceChanged }
  | { kind: 'alias'; code: string; event: string; payload: Record<string, unknown> }
  | { kind: 'notice'; code: string; message: string };

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

export type { GameEventView };
