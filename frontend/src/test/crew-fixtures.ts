import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type GameEvent,
  type PlayerSnapshot,
  type PublicIsland,
  type PublicPlayer,
  type RoomSnapshot,
  type RoomState,
  type RoomStatePush,
  type SeatGrant,
  type VoyageSnapshot,
} from "@/lib/socket/contract";

/** Frontend-protocol builders for reducer and selector tests. Every value is plain test data. */

export const T0 = Date.parse("2026-10-03T12:00:00.000Z");

export function sailor(id: string, name: string, overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id,
    name,
    avatarId: "captain",
    isCaptain: false,
    isReady: false,
    isConnected: true,
    joinedAt: T0,
    ...overrides,
  };
}

export const ANNE = sailor("anne", "Anne Bonny", { isCaptain: true });
export const JACK = sailor("jack", "Calico Jack");
export const MARY = sailor("mary", "Mary Read");

function publicIsland(key: string, name: string, order: number, puzzleKey: string, kind: PublicIsland["kind"] = "NORMAL"): PublicIsland {
  return {
    id: key,
    key,
    name,
    description: "",
    x: order * 10,
    y: 50,
    order,
    kind,
    puzzles: [{ id: puzzleKey, key: puzzleKey, prompt: "", cipher: "riddle", order: 1, hintCount: 2 }],
  };
}

export const PUBLIC_ISLANDS: PublicIsland[] = [
  publicIsland("port-royal", "Port Royal", 1, "port-royal-map"),
  publicIsland("blackreef", "Blackreef", 2, "blackreef-cipher"),
  publicIsland("serpent-cay", "Serpent Cay", 3, "serpent-anagram"),
  publicIsland("deadmans-shelf", "Deadman's Shelf", 4, "deadman-plaque", "TRAP"),
  publicIsland("widows-rock", "Widow's Rock", 5, "widow-riddle"),
  publicIsland("kraken-shoal", "Kraken Shoal", 6, "kraken-arms", "TRAP"),
  publicIsland("goldmouth", "Goldmouth", 7, "goldmouth-tides"),
  publicIsland("the-vault", "The Vault", 8, "vault-protocol", "TREASURE"),
];

export function voyage(overrides: Partial<VoyageSnapshot> = {}): VoyageSnapshot {
  return {
    status: "sailing",
    startedAt: T0,
    endsAt: null,
    finishedAt: null,
    finishReason: null,
    islands: PUBLIC_ISLANDS,
    sailors: [],
    progress: [],
    discovered: ["port-royal"],
    log: [],
    lastSeq: 0,
    scores: [],
    winnerPlayerId: null,
    ...overrides,
  };
}

export function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: "ABC234",
    crewName: "The Black Gull",
    phase: "lobby",
    captainId: ANNE.id,
    players: [ANNE],
    maxPlayers: 6,
    minPlayers: 2,
    createdAt: T0,
    settings: DEFAULT_SETTINGS,
    voyage: null,
    ...overrides,
  };
}

export function push(snapshot: RoomSnapshot, extra: Partial<Pick<RoomStatePush, "you" | "yourHints">> = {}): RoomStatePush {
  return { ...snapshot, you: extra.you ?? [], yourHints: extra.yourHints ?? [] };
}

export function grant(snapshot: RoomSnapshot, playerId = ANNE.id, chat: ChatMessage[] = []): SeatGrant {
  return { room: snapshot, playerId, sessionToken: "token", chat };
}

export function gameEvent(seq: number, type: string, playerId: string | null, payload: Record<string, unknown> = {}): GameEvent {
  return {
    id: `evt-${seq}`,
    seq,
    type,
    payload,
    playerId,
    createdAt: new Date(T0 + seq * 1000).toISOString(),
  };
}

export function chat(id: string, seqNo: number, playerId: string | null, text = "Ahoy"): ChatMessage {
  return { id, seq: seqNo, playerId, kind: "text", text, callId: null, sentAt: T0 + seqNo, filtered: false };
}

export function publicPlayer(id: string, username: string, overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id,
    userId: id,
    username,
    avatarId: "captain",
    isHost: false,
    isOnline: true,
    isEliminated: false,
    strikes: 0,
    hintsUsed: 0,
    followingId: null,
    lastSeenAt: new Date(T0).toISOString(),
    currentIslandKey: "port-royal",
    ...overrides,
  };
}

export function roomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABC234",
    name: "The Black Gull",
    status: "ACTIVE",
    maxPlayers: 6,
    hostId: "anne",
    createdAt: new Date(T0).toISOString(),
    settings: DEFAULT_SETTINGS,
    players: [publicPlayer("anne", "Anne Bonny", { isHost: true }), publicPlayer("jack", "Calico Jack")],
    islands: PUBLIC_ISLANDS,
    progress: [],
    discovered: ["port-royal"],
    log: [],
    scores: [],
    endsAt: null,
    finishReason: null,
    winnerPlayerId: null,
    you: [],
    hints: [],
    ...overrides,
  };
}
