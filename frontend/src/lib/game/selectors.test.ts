import { describe, expect, it } from "vitest";
import { MAX_STRIKES, START_ISLAND_KEY } from "../socket/contract";
import {
  describeEvent,
  discoveredFromState,
  findPlayer,
  heldRelics,
  islandByKey,
  islandForPuzzle,
  isVaultReady,
  moveCount,
  relicsOf,
  replayFrame,
  sailorsAt,
  solvedKeys,
  trailsFrom,
  voyageStartedAt,
  voyageStats,
} from "./selectors";
import { T0, gameEvent, publicPlayer, roomState } from "@/test/crew-fixtures";

const relicItems = (...keys: string[]) => keys.map((itemKey) => ({ itemKey, name: itemKey, description: "", quantity: 1 }));
const solved = (playerId: string, ...puzzleKeys: string[]) => puzzleKeys.map((puzzleKey) => ({ playerId, puzzleKey }));
const moved = (seq: number, playerId: string, islandKey: string) => gameEvent(seq, "MOVED", playerId, { islandKey });

describe("lookups", () => {
  const room = roomState();

  it("find sailors, islands and the island a puzzle sits on", () => {
    expect(findPlayer(room, "jack")?.username).toBe("Calico Jack");
    expect(findPlayer(room, null)).toBeNull();
    expect(findPlayer(room, "ghost")).toBeNull();
    expect(islandByKey(room, "goldmouth")?.name).toBe("Goldmouth");
    expect(islandByKey(room, undefined)).toBeNull();
    expect(islandForPuzzle(room, "kraken-arms")?.key).toBe("kraken-shoal");
    expect(islandForPuzzle(room, 42)).toBeNull();
  });

  it("list the puzzles one sailor has solved", () => {
    const state = roomState({ progress: [...solved("anne", "port-royal-map"), ...solved("jack", "blackreef-cipher")] });
    expect([...solvedKeys(state, "anne")]).toEqual(["port-royal-map"]);
  });

  it("find the sailors anchored at an island", () => {
    const state = roomState({
      players: [publicPlayer("anne", "Anne Bonny", { currentIslandKey: "goldmouth" }), publicPlayer("jack", "Calico Jack")],
    });
    expect(sailorsAt(state, "goldmouth").map((p) => p.id)).toEqual(["anne"]);
  });
});

describe("relics", () => {
  it("are earned from solves on relic islands only, in the canonical order", () => {
    const state = roomState({ progress: solved("anne", "kraken-arms", "blackreef-cipher", "port-royal-map") });
    expect(relicsOf(state, "anne")).toEqual(["compass", "spyglass"]);
  });

  it("in the hold are read from this sailor's own inventory", () => {
    expect(heldRelics(roomState({ you: relicItems("gold-seal", "tide-rumor", "compass") }))).toEqual(["compass", "gold-seal"]);
  });

  it("wake the Vault only when all five are held", () => {
    expect(isVaultReady(roomState({ you: relicItems("compass", "spyglass", "serpent-key", "widow-chart") }))).toBe(false);
    expect(isVaultReady(roomState({ you: relicItems("compass", "spyglass", "serpent-key", "widow-chart", "gold-seal") }))).toBe(true);
  });
});

describe("discoveredFromState", () => {
  it("always includes the home port", () => {
    const state = roomState({ players: [publicPlayer("anne", "Anne Bonny", { currentIslandKey: null })] });
    expect(discoveredFromState(state)).toEqual([START_ISLAND_KEY]);
  });

  it("adds where sailors stand, what they solved and where they sailed", () => {
    const state = roomState({
      players: [publicPlayer("anne", "Anne Bonny", { currentIslandKey: "blackreef" })],
      progress: solved("anne", "widow-riddle"),
      log: [moved(1, "anne", "goldmouth")],
    });
    expect(discoveredFromState(state).sort()).toEqual(["blackreef", "goldmouth", "port-royal", "widows-rock"]);
  });
});

describe("voyageStartedAt", () => {
  it("dates the voyage from the first event that is not an arrival", () => {
    const joined = gameEvent(1, "PLAYER_JOINED", "jack");
    const first = moved(2, "anne", "blackreef");
    expect(voyageStartedAt(roomState({ log: [joined, first] }))).toBe(Date.parse(first.createdAt));
  });

  it("falls back to when the crew was raised", () => {
    expect(voyageStartedAt(roomState())).toBe(T0);
  });
});

describe("describeEvent", () => {
  const room = roomState({ you: [] });
  const say = (type: string, playerId: string | null, payload: Record<string, unknown> = {}) =>
    describeEvent(room, gameEvent(1, type, playerId, payload), "anne");

  it("carries the event's id and time", () => {
    const line = say("MOVED", "jack", { islandKey: "goldmouth" });
    expect(line).toMatchObject({ id: "evt-1", at: T0 + 1000, tone: "move", text: "Calico Jack dropped anchor at Goldmouth." });
  });

  it("describes arrivals and departures", () => {
    expect(say("PLAYER_JOINED", "jack").text).toBe("Calico Jack came aboard.");
    expect(say("PLAYER_LEFT", "anne").text).toBe("You went ashore.");
  });

  it("places solves and failures by their puzzle", () => {
    expect(say("PUZZLE_SOLVED", "anne", { puzzleKey: "serpent-anagram" }).text).toBe("You cracked the riddle of Serpent Cay.");
    expect(say("PUZZLE_FAILED", "jack", { puzzleKey: "serpent-anagram" }).text).toBe("Calico Jack answered wrongly at Serpent Cay.");
  });

  it("counts strikes, even when the server left the count out", () => {
    expect(say("TRAP_TRIGGERED", "jack", { puzzleKey: "kraken-arms", strikes: 1 }).text).toBe(
      `Calico Jack sprang a trap at Kraken Shoal — strike 1/${MAX_STRIKES}.`,
    );
    expect(say("TRAP_TRIGGERED", "jack", { puzzleKey: "kraken-arms" }).text).toContain(`strike ?/${MAX_STRIKES}`);
    expect(say("TRAP_TRIGGERED", "jack", { puzzleKey: "kraken-arms", strikes: 3, eliminated: true }).text).toMatch(
      /The sea has claimed them\.$/,
    );
  });

  it("names items by their lore", () => {
    expect(say("ITEM_GRANTED", "anne", { itemKey: "spyglass" }).text).toBe("You recovered the Blackreef Spyglass.");
    expect(say("ITEM_GRANTED", "jack", { itemKey: "cursed-coin" })).toMatchObject({ tone: "trap", text: "Calico Jack was handed a Cursed Coin." });
    expect(say("TRADED", "jack", { itemKey: "tide-rumor", fromPlayerId: "jack", toPlayerId: "anne" }).text).toBe(
      "Calico Jack passed a Tide Rumor to You.",
    );
  });

  it("celebrates the treasure and shrugs at the unknown", () => {
    expect(say("TREASURE_FOUND", "jack")).toMatchObject({ tone: "treasure", text: "Calico Jack opened The Vault. The hoard is claimed!" });
    expect(say("SEA_SHANTY", null)).toMatchObject({ tone: "info", text: "A sailor: sea shanty." });
  });
});

describe("voyageStats", () => {
  it("totals the crew's real progress", () => {
    const state = roomState({
      players: [publicPlayer("anne", "Anne Bonny", { strikes: 1 }), publicPlayer("jack", "Calico Jack", { strikes: 2 })],
      progress: [...solved("anne", "port-royal-map", "blackreef-cipher"), ...solved("jack", "port-royal-map")],
      winnerPlayerId: "anne",
    });
    expect(voyageStats(state, 4)).toEqual({
      islandsDiscovered: 4,
      islandsTotal: 8,
      puzzlesSolved: 3,
      relicsRecovered: 2,
      trapsSprung: 3,
      plunder: 3 * 120 + 2 * 80 + 4 * 40 + 600 - 3 * 50,
    });
  });

  it("never reports negative plunder", () => {
    const state = roomState({ players: [publicPlayer("anne", "Anne Bonny", { strikes: 3, isEliminated: true })] });
    expect(voyageStats(state, 1).plunder).toBe(0);
  });
});

describe("trails and replays", () => {
  const log = [
    moved(1, "anne", "blackreef"),
    gameEvent(2, "PUZZLE_SOLVED", "anne", { puzzleKey: "blackreef-cipher" }),
    moved(3, "jack", "serpent-cay"),
    moved(4, "anne", "blackreef"),
    moved(5, "anne", "goldmouth"),
  ];
  const room = roomState({ log });

  it("draw each sailor's wake from the home port, skipping repeat anchorings", () => {
    const trails = trailsFrom(room);
    expect(trails.get("anne")).toEqual(["port-royal", "blackreef", "goldmouth"]);
    expect(trails.get("jack")).toEqual(["port-royal", "serpent-cay"]);
  });

  it("count every recorded move", () => {
    expect(moveCount(room)).toBe(4);
  });

  it("ignore moves without a sailor or an island", () => {
    const odd = roomState({ log: [gameEvent(1, "MOVED", null, { islandKey: "blackreef" }), gameEvent(2, "MOVED", "anne", {})] });
    expect(moveCount(odd)).toBe(0);
  });

  it("rewind the chart to the start", () => {
    const { frame, event } = replayFrame(room, 0);
    expect(event).toBeNull();
    expect(frame.log).toEqual([]);
    expect(frame.players.every((p) => p.currentIslandKey === START_ISLAND_KEY)).toBe(true);
  });

  it("replay the chart move by move", () => {
    const { frame, event } = replayFrame(room, 2);
    expect(event?.id).toBe(log[2].id);
    expect(frame.log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(Object.fromEntries(frame.players.map((p) => [p.id, p.currentIslandKey]))).toEqual({
      anne: "blackreef",
      jack: "serpent-cay",
    });
  });

  it("never touch the room it replays", () => {
    replayFrame(room, 1);
    expect(room.log).toHaveLength(5);
    expect(room.players[0].currentIslandKey).toBe("port-royal");
  });
});
