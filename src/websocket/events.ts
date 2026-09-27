import { RoomState } from '../rooms/room.types';
import { GameEventView } from '../common/game-events';
import { PresenceChanged } from '../rooms/room.types';

export const ClientEvents = {
  CREATE: 'room:create',
  JOIN: 'room:join',
  LEAVE: 'room:leave',
  PRESENCE: 'presence:update',
  MOVE: 'map:move',
  ANSWER: 'puzzle:submit',
  TRADE: 'trade:offer',
} as const;

export const ServerEvents = {
  STATE: 'room:state',
  PRESENCE: 'presence:changed',
  EVENT: 'game:event',
  ERROR: 'game:error',
} as const;

export interface GameError {
  message: string;
}

export interface ServerToClient {
  [ServerEvents.STATE]: (state: RoomState) => void;
  [ServerEvents.PRESENCE]: (presence: PresenceChanged) => void;
  [ServerEvents.EVENT]: (event: GameEventView & { code: string }) => void;
  [ServerEvents.ERROR]: (error: GameError) => void;
}
