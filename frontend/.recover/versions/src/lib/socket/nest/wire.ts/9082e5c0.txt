/**
 * The NestJS game server's own wire format (`src/websocket/events.ts` and `src/rooms/room.types.ts`
 * at the repo root). Nothing outside `lib/socket/nest/` should touch these shapes.
 */

export const NestClientEvents = {
  CREATE: "room:create",
  JOIN: "room:join",
  LEAVE: "room:leave",
  MOVE: "map:move",
  ANSWER: "puzzle:submit",
  TRADE: "trade:offer",
} as const;

export const NestServerEvents = {
  STATE: "room:state",
  PRESENCE: "presence:changed",
  EVENT: "game:event",
  /**
   * Sent for every failed request instead of an ack. Nest's filter also emits `exception` right
   * after it; listening to both would pin the second copy on the next request.
   */
  ERROR: "game:error",
} as const;

export type NestStatus = "LOBBY" | "ACTIVE" | "FINISHED";

export interface NestInventoryItem {
  itemKey: string;
  name: string;
  description: string;
  quantity: number;
}

export interface NestPlayer {
  id: string;
  userId: string;
  username: string;
  isHost: boolean;
  isOnline: boolean;
  isEliminated: boolean;
  strikes: number;
  lastSeenAt: string;
  currentIslandKey: string | null;
}

export interface NestPuzzle {
  id: string;
  key: string;
  prompt: string;
  cipher: string;
  order: number;
}

export interface NestIsland {
  id: string;
  key: string;
  name: string;
  description: string;
  x: number;
  y: number;
  order: number;
  kind: "NORMAL" | "TRAP" | "TREASURE";
  puzzles: NestPuzzle[];
}

export interface NestEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  playerId: string | null;
  createdAt: string;
}

export interface NestRoomState {
  code: string;
  name: string;
  status: NestStatus;
  maxPlayers: number;
  /** A user id, not a player id. */
  hostId: string;
  createdAt: string;
  players: NestPlayer[];
  islands: NestIsland[];
  progress: { playerId: string; puzzleKey: string }[];
  /** The newest 40 events, oldest first. */
  log: NestEvent[];
  winnerPlayerId: string | null;
  you: NestInventoryItem[];
}

export interface NestPresence {
  code: string;
  playerId: string;
  userId: string;
  online: boolean;
  lastSeenAt: string;
}

export interface NestGuestSession {
  token: string;
  expiresAt: string;
  user: { id: string; username: string };
}
