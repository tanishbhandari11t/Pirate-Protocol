/** Shared Socket.IO contract for clients (Person B). Keep in sync with gateway + lobby. */

export const AVATAR_IDS = [
  'captain',
  'corsair',
  'navigator',
  'gunner',
  'sea-witch',
  'quartermaster',
  'old-salt',
  'powder-monkey',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const PLAYER_NAME_MAX = 16;
export const CREW_NAME_MAX = 40;
export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export type ClientErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NAME_TAKEN'
  | 'NOT_CAPTAIN'
  | 'NOT_READY'
  | 'UNAUTHORIZED';

export type AckOk<T> = { ok: true; data: T };
export type AckFail = { ok: false; error: { code: ClientErrorCode; message: string } };
export type Ack<T> = AckOk<T> | AckFail;

export interface LobbyPlayerSnapshot {
  id: string;
  name: string;
  avatarId: string | null;
  isCaptain: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: string;
}

export interface LobbyRoomSnapshot {
  code: string;
  crewName: string;
  phase: 'lobby' | 'countdown' | 'in-game' | 'finished';
  captainId: string;
  players: LobbyPlayerSnapshot[];
  maxPlayers: number;
  minPlayers: number;
  createdAt: string;
  countdownEndsAt: string | null;
}

export const ClientEvents = {
  crewCreate: 'crew:create',
  crewJoin: 'crew:join',
  crewLeave: 'crew:leave',
  crewReady: 'crew:ready',
  crewStart: 'crew:start',
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  presenceUpdate: 'presence:update',
  mapMove: 'map:move',
  islandExplore: 'island:explore',
  puzzleSubmit: 'puzzle:submit',
  tradeOffer: 'trade:offer',
} as const;

export const ServerEvents = {
  roomState: 'room:state',
  presenceChanged: 'presence:changed',
  gameEvent: 'game:event',
  gameError: 'game:error',
  serverNotice: 'server:notice',
  gameStarting: 'game:starting',
  gameStarted: 'game:started',
  gameFinished: 'game:finished',
  puzzleSolved: 'puzzle:solved',
  puzzleFailed: 'puzzle:failed',
  trapTriggered: 'trap:triggered',
  inventoryUpdated: 'inventory:updated',
  islandDiscovered: 'island:discovered',
  mapUpdated: 'map:updated',
} as const;

/** Voyage `room:state` also includes islands, progress, log, you, vault, scores — see backend RoomState. */
