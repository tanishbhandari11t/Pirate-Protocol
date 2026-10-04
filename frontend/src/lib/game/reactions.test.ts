import { describe, expect, it } from "vitest";
import { gameEvent } from "@/test/crew-fixtures";
import { mergeReactions, reactionsFor, type Reaction } from "./reactions";

const moods = (type: string, playerId: string | null, payload: Record<string, unknown> = {}) =>
  reactionsFor(gameEvent(1, type, playerId, payload)).map((r) => [r.playerId, r.mood]);

describe("reactionsFor", () => {
  it("cheers the solver of a riddle and the finder of the treasure", () => {
    expect(moods("PUZZLE_SOLVED", "anne", { puzzleKey: "p", islandKey: "i" })).toEqual([["anne", "cheer"]]);
    expect(moods("TREASURE_FOUND", "jack", { puzzleKey: "vault" })).toEqual([["jack", "cheer"]]);
  });

  it("startles a sailor who springs a trap and turns grim when it claims them", () => {
    expect(moods("TRAP_TRIGGERED", "anne", { puzzleKey: "p", islandKey: "i", strikes: 1, eliminated: false })).toEqual([
      ["anne", "shock"],
    ]);
    expect(moods("TRAP_TRIGGERED", "anne", { puzzleKey: "p", islandKey: "i", strikes: 3, eliminated: true })).toEqual([
      ["anne", "grim"],
    ]);
  });

  it("is pleased by a relic and alarmed by a cursed coin", () => {
    expect(moods("ITEM_GRANTED", "anne", { itemKey: "compass", quantity: 1 })).toEqual([["anne", "sly"]]);
    expect(moods("ITEM_GRANTED", "anne", { itemKey: "cursed-coin", quantity: 1 })).toEqual([["anne", "shock"]]);
  });

  it("gives both sides of a trade a face", () => {
    expect(
      moods("TRADED", "anne", { itemKey: "tide-rumor", quantity: 1, fromPlayerId: "anne", toPlayerId: "jack" }),
    ).toEqual([
      ["anne", "sly"],
      ["jack", "cheer"],
    ]);
  });

  it("ignores crew-wide and unknown events", () => {
    expect(moods("TIME_WARNING", null, { minutesLeft: 1 })).toEqual([]);
    expect(moods("PUZZLE_SOLVED", null, { puzzleKey: "p", islandKey: "i" })).toEqual([]);
    expect(moods("SOMETHING_NEW", "anne")).toEqual([]);
  });

  it("tags each reaction with the event that caused it", () => {
    const event = gameEvent(7, "PUZZLE_FAILED", "mary", { puzzleKey: "p", islandKey: "i" });
    expect(reactionsFor(event)).toEqual([{ playerId: "mary", mood: "grim", eventId: event.id }]);
  });
});

describe("mergeReactions", () => {
  const r = (playerId: string, eventId: string): Reaction => ({ playerId, mood: "cheer", eventId });

  it("keeps the same object when nothing arrives", () => {
    const current = { anne: r("anne", "e1") };
    expect(mergeReactions(current, [])).toBe(current);
  });

  it("replaces a sailor's older reaction and leaves the rest", () => {
    const merged = mergeReactions({ anne: r("anne", "e1"), jack: r("jack", "e2") }, [r("anne", "e3")]);
    expect(merged).toEqual({ anne: r("anne", "e3"), jack: r("jack", "e2") });
  });
});
