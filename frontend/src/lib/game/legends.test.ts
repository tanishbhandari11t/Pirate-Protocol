import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameEvent, publicPlayer, roomState } from "@/test/crew-fixtures";
import { legendFromRoom, legendStore, MAX_LEGENDS, parseLegends } from "./legends";

const log = [
  gameEvent(1, "MOVED", "anne", { islandKey: "blackreef", fromIslandKey: "port-royal" }),
  gameEvent(2, "ISLAND_DISCOVERED", "anne", { islandKey: "blackreef" }),
  gameEvent(3, "PUZZLE_SOLVED", "anne", { puzzleKey: "blackreef-cipher" }),
  gameEvent(4, "MOVED", "jack", { islandKey: "deadmans-shelf", fromIslandKey: "port-royal" }),
  gameEvent(5, "TRAP_TRIGGERED", "jack", { puzzleKey: "deadman-plaque", strikes: 3, eliminated: true }),
  gameEvent(6, "MOVED", "anne", { islandKey: "the-vault", fromIslandKey: "blackreef" }),
  gameEvent(7, "TREASURE_FOUND", "anne", {}),
];

const finished = roomState({
  status: "FINISHED",
  finishReason: "treasure",
  winnerPlayerId: "anne",
  log,
  discovered: ["port-royal", "blackreef", "deadmans-shelf"],
  players: [publicPlayer("anne", "Anne Bonny", { isHost: true }), publicPlayer("jack", "Calico Jack", { isEliminated: true })],
});

describe("legendFromRoom", () => {
  it("writes nothing while the voyage is still at sea", () => {
    expect(legendFromRoom(roomState({ log }), "anne")).toBeNull();
  });

  it("records real routes, discoveries, wrecks and the victor from the server's log", () => {
    const legend = legendFromRoom(finished, "jack")!;
    expect(legend.crewName).toBe("The Black Gull");
    expect(legend.winnerName).toBe("Anne Bonny");
    expect(legend.meName).toBe("Calico Jack");
    expect(legend.riddlesSolved).toBe(1);
    expect(legend.islandsCharted).toBe(3);
    const anne = legend.sailors.find((s) => s.id === "anne")!;
    expect(anne.won).toBe(true);
    expect(anne.route.map((p) => p.x)).toEqual([10, 20, 80]);
    expect(legend.discoveries).toEqual([{ islandName: "Blackreef", by: "Anne Bonny", at: { x: 20, y: 50 } }]);
    expect(legend.wrecks).toEqual([{ name: "Calico Jack", islandName: "Deadman's Shelf", at: { x: 40, y: 50 } }]);
    expect(legend.sailors.find((s) => s.id === "jack")!.wrecked).toBe(true);
  });
});

describe("legend storage", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
      },
      addEventListener() {},
      removeEventListener() {},
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ignores corrupt or foreign data", () => {
    expect(parseLegends("{nope")).toEqual([]);
    expect(parseLegends(JSON.stringify([{ id: 1 }, "x"]))).toEqual([]);
  });

  it("keeps the newest first, deduplicates by voyage and caps the hall", () => {
    const legend = legendFromRoom(finished, "anne")!;
    for (let i = 0; i < MAX_LEGENDS + 3; i++) legendStore.add({ ...legend, id: `v${i}` });
    legendStore.add({ ...legend, id: "v5", crewName: "Renamed" });
    const all = legendStore.all();
    expect(all).toHaveLength(MAX_LEGENDS);
    expect(all[0]).toMatchObject({ id: "v5", crewName: "Renamed" });
    expect(all.filter((l) => l.id === "v5")).toHaveLength(1);
    legendStore.clear();
    expect(legendStore.all()).toEqual([]);
  });
});
