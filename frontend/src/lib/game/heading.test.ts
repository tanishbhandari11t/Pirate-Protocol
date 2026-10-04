import { describe, expect, it } from "vitest";
import { publicPlayer, roomState } from "@/test/crew-fixtures";
import { bearingBetween, destinationLabel, leagues, nextDestination } from "./heading";

const relic = (itemKey: string) => ({ itemKey, name: itemKey, description: "", quantity: 1 });
const ALL_RELICS = ["compass", "spyglass", "serpent-key", "widow-chart", "gold-seal"].map(relic);
const RELIC_PUZZLES = ["port-royal-map", "blackreef-cipher", "serpent-anagram", "widow-riddle", "goldmouth-tides"];

describe("bearingBetween", () => {
  it("measures clockwise from north on a chart where y grows downward", () => {
    expect(bearingBetween({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(0);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(180);
    expect(bearingBetween({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(270);
  });
});

describe("nextDestination", () => {
  it("points at the first relic island the sailor has not solved", () => {
    const dest = nextDestination(roomState(), "anne", new Set(["port-royal"]))!;
    expect(dest.island.key).toBe("port-royal");
    expect(dest.reason).toBe("relic");
    expect(destinationLabel(dest)).toBe("Here, at Port Royal");
  });

  it("moves on once a relic island is solved, and hides the name of uncharted shores", () => {
    const room = roomState({ progress: [{ playerId: "anne", puzzleKey: "port-royal-map" }] });
    const dest = nextDestination(room, "anne", new Set(["port-royal"]))!;
    expect(dest.island.key).toBe("blackreef");
    expect(dest.charted).toBe(false);
    expect(dest.point).toBe("E");
    expect(destinationLabel(dest)).toBe("Uncharted waters to the E");
  });

  it("still points into the fog when the server withholds uncharted puzzles", () => {
    const base = roomState({ progress: [{ playerId: "anne", puzzleKey: "port-royal-map" }] });
    const fogged = { ...base, islands: base.islands.map((i) => (i.key === "port-royal" ? i : { ...i, puzzles: [] })) };
    const dest = nextDestination(fogged, "anne", new Set(["port-royal"]))!;
    expect(dest.island.key).toBe("blackreef");
    expect(dest.charted).toBe(false);
  });

  it("names the island once it is charted", () => {
    const room = roomState({ progress: [{ playerId: "anne", puzzleKey: "port-royal-map" }] });
    const dest = nextDestination(room, "anne", new Set(["port-royal", "blackreef"]))!;
    expect(destinationLabel(dest)).toBe("Blackreef, E");
  });

  it("skips relics other sailors solved; only this sailor's progress counts", () => {
    const room = roomState({ progress: [{ playerId: "jack", puzzleKey: "port-royal-map" }] });
    expect(nextDestination(room, "anne", new Set())!.island.key).toBe("port-royal");
  });

  it("heads for the Vault when this sailor's hold carries every relic", () => {
    const room = roomState({
      you: ALL_RELICS,
      progress: RELIC_PUZZLES.map((puzzleKey) => ({ playerId: "anne", puzzleKey })),
    });
    const dest = nextDestination(room, "anne", new Set())!;
    expect(dest.island.key).toBe("the-vault");
    expect(dest.reason).toBe("vault");
    expect(dest.charted).toBe(true);
  });

  it("falls back to unsolved non-trap islands once every relic island is done", () => {
    const room = roomState({ progress: RELIC_PUZZLES.map((puzzleKey) => ({ playerId: "anne", puzzleKey })) });
    expect(nextDestination(room, "anne", new Set())).toBeNull();
  });

  it("gives no heading to the eliminated or after the voyage", () => {
    const sunk = roomState({ players: [publicPlayer("anne", "Anne Bonny", { isEliminated: true })] });
    expect(nextDestination(sunk, "anne", new Set())).toBeNull();
    expect(nextDestination(roomState({ status: "FINISHED" }), "anne", new Set())).toBeNull();
    expect(nextDestination(roomState(), "nobody", new Set())).toBeNull();
  });
});

describe("leagues", () => {
  it("rounds chart distance to whole leagues", () => {
    expect(leagues(0)).toBe(0);
    expect(leagues(86)).toBe(2);
  });
});
