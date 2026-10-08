import { GameEventView } from '../common/game-events';
import { LobbyRoomSnapshot, PresenceChanged, RoomState } from '../rooms/room.types';

export const ClientEvents = {
  CREATE: 'room:create',
  JOIN: 'room:join',
  LEAVE: 'room:leave',
  PRESENCE: 'presence:update',
  MOVE: 'map:move',
  EXPLORE: 'island:explore',
  ANSWER: 'puzzle:submit',
  TRADE: 'trade:offer',
  CREW_CREATE: 'crew:create',
  CREW_JOIN: 'crew:join',
  CREW_LEAVE: 'crew:leave',
  CREW_READY: 'crew:ready',
  CREW_START: 'crew:start',
} as const;

export const ServerEvents = {
  STATE: 'room:state',
  PRESENCE: 'presence:changed',
  EVENT: 'game:event',
  ERROR: 'game:error',
  NOTICE: 'server:notice',
  PLAYER_LEFT: 'room:player-left',
  CAPTAIN_CHANGED: 'room:captain-changed',
  GAME_STARTING: 'game:starting',
  GAME_STARTED: 'game:started',
  GAME_FINISHED: 'game:finished',
} as const;

export interface GameError {
  message: string;
}

export interface ServerToClient {
  [ServerEvents.STATE]: (state: RoomState | LobbyRoomSnapshot) => void;
  [ServerEvents.PRESENCE]: (presence: PresenceChanged) => void;
  [ServerEvents.EVENT]: (event: GameEventView & { code: string }) => void;
  [ServerEvents.ERROR]: (error: GameError) => void;
  [ServerEvents.NOTICE]: (notice: { message: string; code?: string }) => void;
}
