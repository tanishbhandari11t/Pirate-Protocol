import {
  MAX_STRIKES,
  REQUIRED_RELICS,
  START_ISLAND_KEY,
  type GameEvent,
  type PlayerId,
  type PublicIsland,
  type PublicPlayer,
  type RelicKey,
  type RoomState,
} from "../socket/contract";
import { ISLAND_RELIC, itemInfo } from "./world";

export const VAULT_KEY = "the-vault";

export function findPlayer(room: RoomState, playerId: PlayerId | null | undefined) {
  return playerId ? room.players.find((p) => p.id === playerId) ?? null : null;
}

export function islandByKey(room: RoomState, key: string | null | undefined) {
  return key ? room.islands.find((i) => i.key === key) ?? null : null;
}

export function islandForPuzzle(room: RoomState, puzzleKey: unknown): PublicIsland | null {
  if (typeof puzzleKey !== "string") return null;
  return room.islands.find((i) => i.puzzles.some((p) => p.key === puzzleKey)) ?? null;
}

export function solvedKeys(room: RoomState, playerId: PlayerId) {
  return new Set(room.progress.filter((p) => p.playerId === playerId).map((p) => p.puzzleKey));
}

/** Relics a sailor has earned, inferred from the puzzles they solved. */
export function relicsOf(room: RoomState, playerId: PlayerId): RelicKey[] {
  const relics = new Set<RelicKey>();
  for (const puzzleKey of solvedKeys(room, playerId)) {
    const relic = ISLAND_RELIC[islandForPuzzle(room, puzzleKey)?.key ?? ""];
    if (relic) relics.add(relic);
  }
  return REQUIRED_RELICS.filter((r) => relics.has(r));
}

export function heldRelics(room: RoomState): RelicKey[] {
  const held = new Set(room.you.map((i) => i.itemKey));
  return REQUIRED_RELICS.filter((r) => held.has(r));
}

export function isVaultReady(room: RoomState) {
  return heldRelics(room).length === REQUIRED_RELICS.length;
}

/** Islands the crew has laid eyes on, derived from where sailors are, have been, and what they solved. */
export function discoveredFromState(room: RoomState): string[] {
  const keys = new Set<string>([START_ISLAND_KEY]);
  for (const player of room.players) if (player.currentIslandKey) keys.add(player.currentIslandKey);
  for (const { puzzleKey } of room.progress) {
    const island = islandForPuzzle(room, puzzleKey);
    if (island) keys.add(island.key);
  }
  for (const event of room.log) {
    if (event.type === "MOVED" && typeof event.payload.islandKey === "string") keys.add(event.payload.islandKey);
  }
  return [...keys];
}

export function voyageStartedAt(room: RoomState) {
  const first = room.log.find((e) => e.type !== "PLAYER_JOINED" && e.type !== "PLAYER_LEFT");
  return Date.parse(first?.createdAt ?? room.createdAt);
}

export type LogTone = "join" | "leave" | "move" | "solve" | "fail" | "trap" | "item" | "trade" | "treasure" | "info";

export interface LogLine {
  id: string;
  at: number;
  tone: LogTone;
  text: string;
}

function nameOf(room: RoomState, playerId: unknown, meId: PlayerId | null) {
  if (typeof playerId !== "string") return "A sailor";
  if (playerId === meId) return "You";
  return findPlayer(room, playerId)?.username ?? "A departed sailor";
}

export function describeEvent(room: RoomState, event: GameEvent, meId: PlayerId | null): LogLine {
  const who = nameOf(room, event.playerId, meId);
  const base = { id: event.id, at: Date.parse(event.createdAt) };
  const p = event.payload;
  const islandName = (key: unknown) => (typeof key === "string" ? islandByKey(room, key)?.name : null) ?? "an unknown shore";
  const puzzleIsland = islandForPuzzle(room, p.puzzleKey)?.name ?? "an unknown shore";
  const item = typeof p.itemKey === "string" ? itemInfo(p.itemKey).name : "something";

  switch (event.type) {
    case "PLAYER_JOINED":
      return { ...base, tone: "join", text: `${who} came aboard.` };
    case "PLAYER_LEFT":
      return { ...base, tone: "leave", text: `${who} went ashore.` };
    case "MOVED":
      return { ...base, tone: "move", text: `${who} dropped anchor at ${islandName(p.islandKey)}.` };
    case "PUZZLE_SOLVED":
      return { ...base, tone: "solve", text: `${who} cracked the riddle of ${puzzleIsland}.` };
    case "PUZZLE_FAILED":
      return { ...base, tone: "fail", text: `${who} answered wrongly at ${puzzleIsland}.` };
    case "TRAP_TRIGGERED": {
      const strikes = typeof p.strikes === "number" ? p.strikes : "?";
      const tail = p.eliminated ? " The sea has claimed them." : "";
      return { ...base, tone: "trap", text: `${who} sprang a trap at ${puzzleIsland} — strike ${strikes}/${MAX_STRIKES}.${tail}` };
    }
    case "ITEM_GRANTED":
      return p.itemKey === "cursed-coin"
        ? { ...base, tone: "trap", text: `${who} ${who === "You" ? "were" : "was"} handed a Cursed Coin.` }
        : { ...base, tone: "item", text: `${who} recovered the ${item}.` };
    case "TRADED":
      return {
        ...base,
        tone: "trade",
        text: `${nameOf(room, p.fromPlayerId, meId)} passed a ${item} to ${nameOf(room, p.toPlayerId, meId)}.`,
      };
    case "TREASURE_FOUND":
      return { ...base, tone: "treasure", text: `${who} opened The Vault. The hoard is claimed!` };
    default:
      return { ...base, tone: "info", text: `${who}: ${event.type.toLowerCase().replace(/_/g, " ")}.` };
  }
}

export interface VoyageStats {
  islandsDiscovered: number;
  islandsTotal: number;
  puzzlesSolved: number;
  relicsRecovered: number;
  trapsSprung: number;
  plunder: number;
}

/** Crew totals for the final tally. Plunder is a client-side summary of real server progress. */
export function voyageStats(room: RoomState, discovered: number): VoyageStats {
  const relics = new Set<RelicKey>();
  for (const player of room.players) relicsOf(room, player.id).forEach((r) => relics.add(r));
  const puzzlesSolved = room.progress.length;
  const trapsSprung = room.players.reduce((sum, p) => sum + p.strikes, 0);
  const plunder =
    puzzlesSolved * 120 + relics.size * 80 + discovered * 40 + (room.winnerPlayerId ? 600 : 0) - trapsSprung * 50;
  return {
    islandsDiscovered: discovered,
    islandsTotal: room.islands.length,
    puzzlesSolved,
    relicsRecovered: relics.size,
    trapsSprung,
    plunder: Math.max(0, plunder),
  };
}

function moves(room: RoomState) {
  return room.log.filter(
    (e): e is GameEvent & { playerId: PlayerId } => e.type === "MOVED" && !!e.playerId && typeof e.payload.islandKey === "string",
  );
}

/** Each sailor's wake: the islands they sailed to, in order, from the moves still in the log. */
export function trailsFrom(room: RoomState): Map<PlayerId, string[]> {
  const trails = new Map<PlayerId, string[]>();
  for (const move of moves(room)) {
    const trail = trails.get(move.playerId) ?? [START_ISLAND_KEY];
    const key = move.payload.islandKey as string;
    if (trail[trail.length - 1] !== key) trail.push(key);
    trails.set(move.playerId, trail);
  }
  return trails;
}

export function moveCount(room: RoomState) {
  return moves(room).length;
}

/** The room as it stood after its first `steps` recorded moves, for replaying the voyage. */
export function replayFrame(room: RoomState, steps: number): { frame: RoomState; event: GameEvent | null } {
  const shown = moves(room).slice(0, steps);
  const positions = new Map(shown.map((m) => [m.playerId, m.payload.islandKey as string]));
  const last = shown.at(-1) ?? null;
  const frame: RoomState = {
    ...room,
    log: last ? room.log.slice(0, room.log.indexOf(last) + 1) : [],
    players: room.players.map((p) => ({ ...p, currentIslandKey: positions.get(p.id) ?? START_ISLAND_KEY })),
  };
  return { frame, event: last };
}

export function sailorsAt(room: RoomState, islandKey: string): PublicPlayer[] {
  return room.players.filter((p) => p.currentIslandKey === islandKey);
}
