import type { NestEvent, NestInventoryItem, NestIsland, NestPlayer, NestRoomState } from "@/lib/socket/nest/wire";

/**
 * Hand-built server states shaped like the NestJS backend's `room:state`, using the seeded
 * island and puzzle keys from `prisma/seed.ts`. Tests build on these instead of a live server.
 */

export const CODE = "ABC234";
export const CREATED_AT = "2026-10-03T12:00:00.000Z";

export const ANNE = { id: "player-anne", userId: "user-anne", username: "anne_bonny" } as const;
export const JACK = { id: "player-jack", userId: "user-jack", username: "calico_jack" } as const;
export const MARY = { id: "player-mary", userId: "user-mary", username: "mary_read" } as const;

type Identity = { id: string; userId: string; username: string };

export function player(who: Identity, overrides: Partial<NestPlayer> = {}): NestPlayer {
  return {
    id: who.id,
    userId: who.userId,
    username: who.username,
    isHost: false,
    isOnline: true,
    isEliminated: false,
    strikes: 0,
    lastSeenAt: CREATED_AT,
    currentIslandKey: "port-royal",
    ...overrides,
  };
}

function island(key: string, name: string, order: number, kind: NestIsland["kind"], puzzleKey: string): NestIsland {
  return {
    id: `island-${key}`,
    key,
    name,
    description: `${name}, as the seed describes it.`,
    x: order * 10,
    y: 50,
    order,
    kind,
    puzzles: [{ id: `puzzle-${puzzleKey}`, key: puzzleKey, prompt: `The riddle of ${name}.`, cipher: "riddle", order: 1 }],
  };
}

export const ISLANDS: NestIsland[] = [
  island("port-royal", "Port Royal", 1, "NORMAL", "port-royal-map"),
  island("blackreef", "Blackreef", 2, "NORMAL", "blackreef-cipher"),
  island("serpent-cay", "Serpent Cay", 3, "NORMAL", "serpent-anagram"),
  island("deadmans-shelf", "Deadman's Shelf", 4, "TRAP", "deadman-plaque"),
  island("widows-rock", "Widow's Rock", 5, "NORMAL", "widow-riddle"),
  island("kraken-shoal", "Kraken Shoal", 6, "TRAP", "kraken-arms"),
  island("goldmouth", "Goldmouth", 7, "NORMAL", "goldmouth-tides"),
  island("the-vault", "The Vault", 8, "TREASURE", "vault-protocol"),
];

export function item(itemKey: string, quantity = 1): NestInventoryItem {
  return { itemKey, name: itemKey, description: `A ${itemKey}.`, quantity };
}

export const ALL_RELICS = ["compass", "spyglass", "serpent-key", "widow-chart", "gold-seal"].map((key) => item(key));

let eventCounter = 0;

export function event(type: string, playerId: string | null, payload: Record<string, unknown> = {}, at?: string): NestEvent {
  eventCounter += 1;
  return {
    id: `event-${eventCounter}`,
    type,
    payload,
    playerId,
    createdAt: at ?? new Date(Date.parse(CREATED_AT) + eventCounter * 1000).toISOString(),
  };
}

export function state(overrides: Partial<NestRoomState> = {}): NestRoomState {
  return {
    code: CODE,
    name: "The Black Gull",
    status: "LOBBY",
    maxPlayers: 6,
    hostId: ANNE.userId,
    createdAt: CREATED_AT,
    players: [player(ANNE, { isHost: true })],
    islands: ISLANDS,
    progress: [],
    log: [],
    winnerPlayerId: null,
    you: [],
    ...overrides,
  };
}

/** A token in the backend's `base64url(JSON).signature` shape. The signature is never checked client-side. */
export function tokenFor(userId: string, signature = "signature"): string {
  const body = btoa(JSON.stringify({ userId, exp: Date.parse(CREATED_AT) + 7 * 24 * 3600 * 1000 }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${body}.${signature}`;
}
