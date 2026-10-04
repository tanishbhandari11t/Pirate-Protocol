import { isGameEvent, type GameEvent, type PlayerId } from "../socket/contract";
import { itemInfo } from "./world";

/** How a portrait reacts to something that just happened at sea. */
export type Mood = "cheer" | "shock" | "grim" | "sly";

export interface Reaction {
  playerId: PlayerId;
  mood: Mood;
  /** The event that caused it, so repeated reactions restart their animation. */
  eventId: string;
}

/** How long a face holds a reaction before relaxing. */
export const REACTION_MS = 3200;

/**
 * Who reacts to a voyage event, and how. Only events the server recorded are used, so faces never
 * hint at anything the log does not already show.
 */
export function reactionsFor(event: GameEvent): Reaction[] {
  const at = (playerId: PlayerId | null, mood: Mood): Reaction[] =>
    playerId ? [{ playerId, mood, eventId: event.id }] : [];

  if (isGameEvent(event, "PUZZLE_SOLVED")) return at(event.playerId, "cheer");
  if (isGameEvent(event, "TREASURE_FOUND")) return at(event.playerId, "cheer");
  if (isGameEvent(event, "PUZZLE_FAILED")) return at(event.playerId, "grim");
  if (isGameEvent(event, "TRAP_TRIGGERED")) return at(event.playerId, event.payload.eliminated ? "grim" : "shock");
  if (isGameEvent(event, "ITEM_GRANTED"))
    return at(event.playerId, itemInfo(event.payload.itemKey).rarity === "cursed" ? "shock" : "sly");
  if (isGameEvent(event, "HINT_BOUGHT")) return at(event.playerId, "sly");
  if (isGameEvent(event, "ISLAND_DISCOVERED")) return at(event.playerId, "cheer");
  if (isGameEvent(event, "TRADED"))
    return [...at(event.payload.fromPlayerId, "sly"), ...at(event.payload.toPlayerId, "cheer")];
  return [];
}

/** Keeps the newest reaction per sailor. */
export function mergeReactions(current: Record<PlayerId, Reaction>, incoming: Reaction[]): Record<PlayerId, Reaction> {
  if (incoming.length === 0) return current;
  const next = { ...current };
  for (const r of incoming) next[r.playerId] = r;
  return next;
}
