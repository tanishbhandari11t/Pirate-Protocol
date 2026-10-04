/**
 * Pirate Protocol — Socket.IO wire contract (Phase 1: crews & lobby).
 *
 * This file is the single source of truth shared with the backend.
 * Every client → server event is a request that MUST be acknowledged with an `Ack<T>`.
 * Every server → client event is a push with a single payload object.
 */

export const PROTOCOL_VERSION = 1;

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PLAYER_NAME_MAX = 16;
export const CREW_NAME_MAX = 24;
export const MIN_CREW_SIZE = 2;
export const MAX_CREW_SIZE = 6;

export const AVATAR_IDS = [
  "captain",
  "corsair",
  "navigator",
  "gunner",
  "sea-witch",
  "quartermaster",
  "old-salt",
  "powder-monkey",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

/* ---------- Domain snapshots ---------- */

export type PlayerId = string;
export type RoomCode = string;

export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  avatarId: AvatarId;
  isCaptain: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export type RoomPhase = "lobby" | "starting" | "in-game" | "finished";

export interface RoomSnapshot {
  code: RoomCode;
  crewName: string;
  phase: RoomPhase;
  captainId: PlayerId;
  players: PlayerSnapshot[];
  maxPlayers: number;
  minPlayers: number;
  createdAt: number;
}

export type VoyagePhase = "duties" | "chart" | "won" | "lost";

export interface DutyOption {
  id: string;
  label: string;
}

/** This sailor's private watch. The correct answer stays on the server. */
export interface MyDuty {
  title: string;
  /** Plain-language order telling this sailor exactly what to tap. */
  orders: string;
  options: DutyOption[];
}

export interface DutyProgress {
  playerId: PlayerId;
  playerName: string;
  title: string;
  done: boolean;
  abandoned: boolean;
  /** Revealed to the whole crew once the watch is kept. */
  clue: string | null;
}

export interface ChartIsland {
  id: string;
  name: string;
}

/**
 * Personal view of the living map. `yourOrders` is the one line this sailor
 * should follow right now. Clues from other watches are public; answers are not.
 */
export interface VoyageSnapshot {
  roomCode: RoomCode;
  phase: VoyagePhase;
  /** How the voyage works, shown the whole time. */
  briefing: string;
  /** The action this sailor should take right now. */
  yourOrders: string;
  duties: DutyProgress[];
  myDuty: MyDuty | null;
  chart: { prompt: string; islands: ChartIsland[] } | null;
  strikes: number;
  maxStrikes: number;
  hoard: string | null;
}

export interface GameActPayload {
  kind: "duty" | "chart";
  choice: string;
}

export interface GameActResult {
  correct: boolean;
  message: string;
  voyage: VoyageSnapshot;
}

/** Returned to a client once it holds a seat in a room. */
export interface SeatGrant {
  room: RoomSnapshot;
  playerId: PlayerId;
  /** Opaque token the client stores to reclaim its seat after a refresh/disconnect. */
  sessionToken: string;
}

/* ---------- Acknowledgements ---------- */

export type ErrorCode =
  | "INVALID_PAYLOAD"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_IN_PROGRESS"
  | "NAME_TAKEN"
  | "NOT_IN_ROOM"
  | "NOT_CAPTAIN"
  | "NOT_ENOUGH_PLAYERS"
  | "PLAYERS_NOT_READY"
  | "SESSION_EXPIRED"
  | "NOT_IN_GAME"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ProtocolError {
  code: ErrorCode;
  message: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ProtocolError };

/* ---------- Client → Server requests ---------- */

export interface CreateCrewPayload {
  playerName: string;
  avatarId: AvatarId;
  crewName: string;
}

export interface JoinCrewPayload {
  playerName: string;
  avatarId: AvatarId;
  roomCode: RoomCode;
}

export interface RejoinCrewPayload {
  roomCode: RoomCode;
  sessionToken: string;
}

export interface SetReadyPayload {
  ready: boolean;
}

export type EmptyPayload = Record<string, never>;

/** Request name → request payload + successful response data. */
export interface ClientRequests {
  "crew:create": { req: CreateCrewPayload; res: SeatGrant };
  "crew:join": { req: JoinCrewPayload; res: SeatGrant };
  "crew:rejoin": { req: RejoinCrewPayload; res: SeatGrant };
  "crew:leave": { req: EmptyPayload; res: null };
  "player:ready": { req: SetReadyPayload; res: PlayerSnapshot };
  "game:start": { req: EmptyPayload; res: null };
  /** Current personal view of the voyage. Used after a refresh mid-game. */
  "game:sync": { req: EmptyPayload; res: VoyageSnapshot };
  /** Attempt the sailor's current order: keep a watch or name the island. */
  "game:act": { req: GameActPayload; res: GameActResult };
}

export type ClientRequestName = keyof ClientRequests;
export type RequestPayload<K extends ClientRequestName> = ClientRequests[K]["req"];
export type ResponseData<K extends ClientRequestName> = ClientRequests[K]["res"];

/* ---------- Server → Client pushes ---------- */

export type LeaveReason = "left" | "disconnected" | "kicked";

export interface ServerEvents {
  /** Authoritative full room state. Sent after every mutation. */
  "room:state": RoomSnapshot;
  "room:player-joined": { player: PlayerSnapshot };
  "room:player-left": { playerId: PlayerId; name: string; reason: LeaveReason };
  "room:player-updated": { player: PlayerSnapshot };
  "room:captain-changed": { captainId: PlayerId };
  /** Captain launched the voyage; clients show a countdown until `startsAt` (epoch ms). */
  "game:starting": { startsAt: number; seconds: number };
  "game:started": { roomCode: RoomCode };
  /** Personal voyage view. Emitted to each sailor separately — duties differ. */
  "voyage:state": VoyageSnapshot;
  "server:notice": { level: "info" | "warning" | "danger"; message: string };
}

export type ServerEventName = keyof ServerEvents;

/* ---------- Socket.IO typings derived from the maps above ---------- */

export type ClientToServerEvents = {
  [K in ClientRequestName]: (
    payload: RequestPayload<K>,
    ack: (response: Ack<ResponseData<K>>) => void,
  ) => void;
};

export type ServerToClientEvents = {
  [K in ServerEventName]: (payload: ServerEvents[K]) => void;
};
