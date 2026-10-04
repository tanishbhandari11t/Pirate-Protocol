import {
  AVATAR_IDS,
  DEFAULT_SETTINGS,
  REQUIRED_RELICS,
  START_ISLAND_KEY,
  type AnswerVerdict,
  type AvatarId,
  type ErrorCode,
  type GameEvent,
  type PlayerSnapshot,
  type PublicIsland,
  type RoomPhase,
  type RoomStatePush,
  type VoyageSettings,
  type VoyageSnapshot,
} from "../contract";
import type { NestEvent, NestPlayer, NestRoomState, NestStatus } from "./wire";

/* ------------------------------------------------------------------ */
/* Names & likenesses                                                  */
/* ------------------------------------------------------------------ */

export const NEST_USERNAME_MIN = 3;
export const NEST_USERNAME_MAX = 16;

/** The server's guest login accepts `^[a-z0-9_]{3,16}$`; "Calico Jack" signs in as `calico_jack`. */
export function toNestUsername(playerName: string): string {
  return playerName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .trim()
    .replace(/[\s_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, NEST_USERNAME_MAX);
}

/** `calico_jack` → `Calico Jack`. Only changes how the server's name is shown. */
export function displayName(username: string): string {
  return username
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

/** The server has no avatars, so each sailor gets a stable likeness from their user id. */
export function avatarFor(userId: string): AvatarId {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_IDS[hash % AVATAR_IDS.length];
}

/** Reads the user id out of the server's `body.signature` token. The body is not secret; only the signature is checked server-side. */
export function userIdFromToken(token: string): string | null {
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as { userId?: unknown };
    return typeof parsed.userId === "string" && parsed.userId ? parsed.userId : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

const MESSAGE_CODES: [RegExp, ErrorCode][] = [
  [/^room not found$/i, "ROOM_NOT_FOUND"],
  [/invalid room code|6 character room code/i, "ROOM_NOT_FOUND"],
  [/^crew is full$/i, "ROOM_FULL"],
  [/^this hunt is over$|already been claimed/i, "VOYAGE_OVER"],
  [/^leave crew [A-Z0-9]+ first$/i, "IN_ANOTHER_CREW"],
  [/not in this crew|join the crew first/i, "NOT_IN_ROOM"],
  [/^island not found$/i, "ISLAND_NOT_FOUND"],
  [/^puzzle not found$/i, "PUZZLE_NOT_FOUND"],
  [/^puzzle already solved$/i, "ALREADY_SOLVED"],
  [/^missing relics/i, "MISSING_RELICS"],
  [/cannot be traded|^unknown item/i, "NOT_TRADABLE"],
  [/choose another sailor|not in your crew/i, "BAD_RECIPIENT"],
  [/do not hold that item/i, "ITEM_NOT_HELD"],
  [/out of the hunt/i, "ELIMINATED"],
  [/invalid token|unauthorized|bearer token/i, "SESSION_EXPIRED"],
  [/too many requests/i, "RATE_LIMITED"],
  [/invalid payload|must be|should not|must match/i, "INVALID_PAYLOAD"],
];

export function errorCodeFor(message: string | undefined): ErrorCode {
  if (!message) return "INTERNAL";
  return MESSAGE_CODES.find(([pattern]) => pattern.test(message))?.[1] ?? "INTERNAL";
}

/** `Leave crew ABC234 first` → `ABC234`. */
export function staleCrewCode(message: string | undefined): string | null {
  return message?.match(/^leave crew ([A-Z0-9]+) first$/i)?.[1]?.toUpperCase() ?? null;
}

/* ------------------------------------------------------------------ */
/* Room state                                                          */
/* ------------------------------------------------------------------ */

/** The server plays one fixed ruleset: three strikes, traps armed, no hints, no clock. */
export const NEST_SETTINGS: VoyageSettings = {
  ...DEFAULT_SETTINGS,
  maxStrikes: 3,
  trapsEnabled: true,
  hintsEnabled: false,
  timeLimitMinutes: 0,
};

const PHASES: Record<NestStatus, RoomPhase> = {
  LOBBY: "lobby",
  ACTIVE: "in-game",
  FINISHED: "finished",
};

const ARRIVALS = new Set(["PLAYER_JOINED", "PLAYER_LEFT"]);

export interface PresenceChange {
  playerId: string;
  online: boolean;
}

/** What changed between two server states, as the frontend protocol would have announced it. */
export interface MirrorChange {
  push: RoomStatePush;
  joined: PlayerSnapshot[];
  left: { playerId: string; name: string }[];
  updated: PlayerSnapshot[];
  captainId: string | null;
  started: boolean;
  finished: boolean;
  /** This sailor's pack just filled with all five relics. */
  vaultAwakened: boolean;
}

/**
 * Keeps one crew's server state and turns it into the frontend protocol: player snapshots,
 * an accumulated fog map, stable `seq` numbers for the log and enriched event payloads.
 * It never decides an outcome; every value comes from what the server sent.
 */
export class NestMirror {
  private raw: NestRoomState | null = null;
  private prev: NestRoomState | null = null;
  private readonly events = new Map<string, GameEvent>();
  private seq = 0;
  private readonly discovered = new Set<string>([START_ISLAND_KEY]);
  private readonly joinedAt = new Map<string, number>();
  private readonly solvedAt = new Map<string, string>();
  private startedAt: number | null = null;
  private finishedAt: number | null = null;
  private vaultAwake = false;

  constructor(
    readonly code: string,
    readonly userId: string,
  ) {}

  get state() {
    return this.raw;
  }

  get playerId(): string | null {
    return this.raw?.players.find((p) => p.userId === this.userId)?.id ?? null;
  }

  me(): NestPlayer | null {
    return this.raw?.players.find((p) => p.userId === this.userId) ?? null;
  }

  isDiscovered(islandKey: string) {
    return this.discovered.has(islandKey);
  }

  /** Records a fresh `room:state` and reports what it changed. */
  ingest(next: NestRoomState): MirrorChange {
    const before = this.raw;
    const beforeSnapshots = before ? this.players(before) : [];
    this.prev = before;
    this.raw = next;
    const now = Date.now();

    for (const event of next.log) {
      if (!this.events.has(event.id)) this.events.set(event.id, this.enrich(event));
      if (event.type === "PLAYER_JOINED" && event.playerId && !this.joinedAt.has(event.playerId)) {
        this.joinedAt.set(event.playerId, Date.parse(event.createdAt));
      }
      if (event.type === "PUZZLE_SOLVED" && event.playerId && typeof event.payload.puzzleKey === "string") {
        this.solvedAt.set(`${event.playerId}:${event.payload.puzzleKey}`, event.createdAt);
      }
      if (event.type === "MOVED" && typeof event.payload.islandKey === "string") {
        this.discovered.add(event.payload.islandKey);
      }
      if (event.type === "TREASURE_FOUND" && this.finishedAt === null) {
        this.finishedAt = Date.parse(event.createdAt);
      }
    }
    for (const player of next.players) {
      if (player.currentIslandKey) this.discovered.add(player.currentIslandKey);
      if (!this.joinedAt.has(player.id)) this.joinedAt.set(player.id, now);
    }
    for (const { playerId, puzzleKey } of next.progress) {
      const island = this.islandOfPuzzle(puzzleKey);
      if (island) this.discovered.add(island.key);
      const key = `${playerId}:${puzzleKey}`;
      if (!this.solvedAt.has(key)) this.solvedAt.set(key, new Date(now).toISOString());
    }

    if (next.status !== "LOBBY" && this.startedAt === null) {
      const first = next.log.find((e) => !ARRIVALS.has(e.type));
      this.startedAt = first ? Date.parse(first.createdAt) : now;
    }
    if (next.status === "FINISHED" && this.finishedAt === null) this.finishedAt = now;

    const relics = new Set(next.you.map((i) => i.itemKey));
    const vaultReady = REQUIRED_RELICS.every((r) => relics.has(r));
    const vaultAwakened = vaultReady && !this.vaultAwake && before !== null;
    this.vaultAwake = vaultReady;

    const afterSnapshots = this.players(next);
    const beforeIds = new Map(beforeSnapshots.map((p) => [p.id, p]));
    const afterIds = new Set(afterSnapshots.map((p) => p.id));
    const captainBefore = before ? this.captainOf(before) : null;
    const captainAfter = this.captainOf(next);

    return {
      push: this.toPush(),
      joined: before ? afterSnapshots.filter((p) => !beforeIds.has(p.id)) : [],
      left: beforeSnapshots.filter((p) => !afterIds.has(p.id)).map((p) => ({ playerId: p.id, name: p.name })),
      updated: afterSnapshots.filter((p) => {
        const old = beforeIds.get(p.id);
        return old !== undefined && old.isConnected !== p.isConnected;
      }),
      captainId: before && captainAfter !== captainBefore ? captainAfter : null,
      started: before?.status === "LOBBY" && next.status !== "LOBBY",
      finished: before !== null && before.status !== "FINISHED" && next.status === "FINISHED",
      vaultAwakened,
    };
  }

  /** Applies a `presence:changed` push; returns the updated sailor, or `null` if nothing changed. */
  presence({ playerId, online }: PresenceChange): PlayerSnapshot | null {
    const raw = this.raw;
    const player = raw?.players.find((p) => p.id === playerId);
    if (!raw || !player || player.isOnline === online) return null;
    this.raw = {
      ...raw,
      players: raw.players.map((p) => (p.id === playerId ? { ...p, isOnline: online } : p)),
    };
    return this.players(this.raw).find((p) => p.id === playerId) ?? null;
  }

  /** The enriched form of a server event, with its `seq`. */
  event(raw: NestEvent): GameEvent {
    const known = this.events.get(raw.id);
    if (known) return known;
    const enriched = this.enrich(raw);
    this.events.set(raw.id, enriched);
    return enriched;
  }

  /** A `VAULT_AWAKENED` for this sailor, derived from the relics the server put in their pack. */
  vaultEvent(): GameEvent {
    this.seq += 1;
    return {
      id: `derived:vault:${this.playerId ?? this.userId}`,
      seq: this.seq,
      type: "VAULT_AWAKENED",
      payload: {},
      playerId: this.playerId,
      createdAt: new Date().toISOString(),
    };
  }

  /** Events newer than `sinceSeq` that the server still keeps in its log. */
  eventsSince(sinceSeq: number): { events: GameEvent[]; lastSeq: number } {
    const log = (this.raw?.log ?? []).map((e) => this.event(e));
    return { events: log.filter((e) => e.seq > sinceSeq), lastSeq: this.seq };
  }

  toPush(): RoomStatePush {
    const raw = this.raw;
    if (!raw) throw new Error("NestMirror has no state yet");
    const phase = PHASES[raw.status];
    return {
      code: raw.code,
      crewName: raw.name,
      phase,
      captainId: this.captainOf(raw) ?? "",
      players: this.players(raw),
      maxPlayers: raw.maxPlayers,
      minPlayers: 1,
      createdAt: Date.parse(raw.createdAt),
      settings: NEST_SETTINGS,
      voyage: phase === "lobby" ? null : this.voyage(raw),
      you: raw.you,
      yourHints: [],
    };
  }

  /** The server's ruling on an answer, read from the state it returned. */
  verdict(before: NestRoomState, after: NestRoomState, puzzleKey: string): AnswerVerdict {
    const meBefore = before.players.find((p) => p.userId === this.userId);
    const meAfter = after.players.find((p) => p.userId === this.userId);
    const playerId = meAfter?.id ?? meBefore?.id ?? "";
    const solved =
      after.progress.some((p) => p.playerId === playerId && p.puzzleKey === puzzleKey) &&
      !before.progress.some((p) => p.playerId === playerId && p.puzzleKey === puzzleKey);
    const strikes = meAfter?.strikes ?? meBefore?.strikes ?? 0;
    const trapped = strikes > (meBefore?.strikes ?? 0);
    const held = new Map(before.you.map((i) => [i.itemKey, i.quantity]));
    const gained = after.you.find((i) => i.quantity > (held.get(i.itemKey) ?? 0));
    return {
      outcome: solved ? "solved" : trapped ? "trap" : "wrong",
      puzzleKey,
      strikes,
      eliminated: meAfter?.isEliminated ?? false,
      reward: solved || trapped ? (gained?.itemKey ?? null) : null,
      treasureFound: !!playerId && after.winnerPlayerId === playerId,
    };
  }

  /* ---------------- internals ---------------- */

  private captainOf(state: NestRoomState): string | null {
    // The server keeps the founder as host even after they leave; the longest-serving sailor takes the helm on screen.
    return (state.players.find((p) => p.isHost) ?? state.players[0])?.id ?? null;
  }

  private players(state: NestRoomState): PlayerSnapshot[] {
    const captainId = this.captainOf(state);
    return state.players.map((p) => ({
      id: p.id,
      name: displayName(p.username),
      avatarId: avatarFor(p.userId),
      isCaptain: p.id === captainId,
      isReady: true,
      isConnected: p.isOnline,
      joinedAt: this.joinedAt.get(p.id) ?? Date.parse(state.createdAt),
    }));
  }

  private islands(state: NestRoomState): PublicIsland[] {
    return state.islands.map((island) => ({
      ...island,
      puzzles: island.puzzles.map((puzzle) => ({ ...puzzle, hintCount: 0 })),
    }));
  }

  private voyage(state: NestRoomState): VoyageSnapshot {
    return {
      status: state.status === "FINISHED" ? "finished" : "sailing",
      startedAt: this.startedAt ?? Date.parse(state.createdAt),
      endsAt: null,
      finishedAt: state.status === "FINISHED" ? this.finishedAt : null,
      finishReason: state.status === "FINISHED" ? "treasure" : null,
      islands: this.islands(state),
      sailors: state.players.map((p) => ({
        playerId: p.id,
        currentIslandKey: p.currentIslandKey,
        strikes: p.strikes,
        isEliminated: p.isEliminated,
        hintsUsed: 0,
        followingId: null,
      })),
      progress: state.progress.map(({ playerId, puzzleKey }) => ({
        playerId,
        puzzleKey,
        solvedAt: this.solvedAt.get(`${playerId}:${puzzleKey}`) ?? state.createdAt,
      })),
      discovered: [...this.discovered],
      log: state.log.map((e) => this.event(e)),
      lastSeq: this.seq,
      scores: [],
      winnerPlayerId: state.winnerPlayerId,
    };
  }

  private islandOfPuzzle(puzzleKey: unknown) {
    if (typeof puzzleKey !== "string") return null;
    return this.raw?.islands.find((i) => i.puzzles.some((p) => p.key === puzzleKey)) ?? null;
  }

  /** Fills in the payload fields the frontend expects. Runs once per event, when it first appears. */
  private enrich(event: NestEvent): GameEvent {
    this.seq += 1;
    const payload: Record<string, unknown> = { ...event.payload };

    if (event.type === "PUZZLE_FAILED" || event.type === "TRAP_TRIGGERED") {
      payload.islandKey ??= this.islandOfPuzzle(payload.puzzleKey)?.key ?? null;
    }
    if (event.type === "MOVED") {
      const mover = this.prev?.players.find((p) => p.id === event.playerId);
      payload.fromIslandKey ??= mover?.currentIslandKey ?? null;
    }
    if (event.type === "ITEM_GRANTED") payload.quantity ??= 1;
    if (event.type === "TRADED") payload.quantity ??= this.tradedQuantity(payload);

    return {
      id: event.id,
      seq: this.seq,
      type: event.type,
      payload,
      playerId: event.playerId,
      createdAt: event.createdAt,
    };
  }

  /** The server hands over the whole stack. Only the two sailors involved can see how big it was. */
  private tradedQuantity(payload: Record<string, unknown>): number {
    const me = this.playerId;
    const itemKey = payload.itemKey;
    if (!me || !this.prev || !this.raw || typeof itemKey !== "string") return 1;
    const count = (state: NestRoomState) => state.you.find((i) => i.itemKey === itemKey)?.quantity ?? 0;
    const delta = Math.abs(count(this.raw) - count(this.prev));
    return (payload.toPlayerId === me || payload.fromPlayerId === me) && delta > 0 ? delta : 1;
  }
}
