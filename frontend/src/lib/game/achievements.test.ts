import { describe, expect, it } from "vitest";
import { achievementsFor } from "./achievements";
import { gameEvent, publicPlayer, roomState } from "@/test/crew-fixtures";

const ids = (...args: Parameters<typeof achievementsFor>) => achievementsFor(...args).map((a) => a.id);
const solved = (playerId: string, ...puzzleKeys: string[]) => puzzleKeys.map((puzzleKey) => ({ playerId, puzzleKey }));

describe("achievementsFor", () => {
  it("awards nothing to a sailor who did nothing", () => {
    expect(ids(roomState(), "jack")).toEqual([]);
  });

  it("crowns the Vault Breaker from the server's winner", () => {
    expect(ids(roomState({ winnerPlayerId: "anne" }), "anne")).toContain("vault-breaker");
    expect(ids(roomState({ winnerPlayerId: "anne" }), "jack")).not.toContain("vault-breaker");
  });

  it("names a Relic Hunter only for all five relics", () => {
    const four = roomState({ progress: solved("anne", "port-royal-map", "blackreef-cipher", "serpent-anagram", "widow-riddle") });
    const five = roomState({ progress: solved("anne", "port-royal-map", "blackreef-cipher", "serpent-anagram", "widow-riddle", "goldmouth-tides") });
    expect(ids(four, "anne")).not.toContain("relic-hunter");
    expect(ids(five, "anne")).toContain("relic-hunter");
  });

  it("honours whoever solved the crew's first riddle", () => {
    const room = roomState({
      progress: [...solved("jack", "blackreef-cipher"), ...solved("anne", "port-royal-map")],
      log: [
        gameEvent(1, "PUZZLE_SOLVED", "jack", { puzzleKey: "blackreef-cipher" }),
        gameEvent(2, "PUZZLE_SOLVED", "anne", { puzzleKey: "port-royal-map" }),
      ],
    });
    expect(ids(room, "jack")).toContain("first-riddle");
    expect(ids(room, "anne")).not.toContain("first-riddle");
  });

  it("calls a strike-free solver Unbroken, but not a sailor who solved nothing", () => {
    const room = roomState({ progress: solved("anne", "port-royal-map") });
    expect(ids(room, "anne")).toContain("unbroken");
    expect(ids(room, "jack")).not.toContain("unbroken");
  });

  it("tells Scarred from Ghost Ship by whether the sailor survived", () => {
    const room = roomState({
      players: [
        publicPlayer("anne", "Anne Bonny", { strikes: 1 }),
        publicPlayer("jack", "Calico Jack", { strikes: 3, isEliminated: true }),
      ],
    });
    expect(ids(room, "anne")).toEqual(["scarred"]);
    expect(ids(room, "jack")).toEqual(["ghost"]);
  });

  it("thanks the giver of a trade, not the receiver", () => {
    const room = roomState({
      log: [gameEvent(1, "TRADED", "jack", { itemKey: "tide-rumor", fromPlayerId: "jack", toPlayerId: "anne", quantity: 1 })],
    });
    expect(ids(room, "jack")).toContain("generous");
    expect(ids(room, "anne")).not.toContain("generous");
  });

  it("makes a Cartographer of a sailor who anchored at six islands", () => {
    const islands = ["blackreef", "serpent-cay", "widows-rock", "goldmouth", "kraken-shoal"];
    const log = islands.map((islandKey, i) => gameEvent(i + 1, "MOVED", "anne", { islandKey }));
    expect(ids(roomState({ log }), "anne")).toContain("cartographer");
    expect(ids(roomState({ log: log.slice(0, 4) }), "anne")).not.toContain("cartographer");
  });

  it("returns plain honours with no scoring rules attached", () => {
    const [honour] = achievementsFor(roomState({ winnerPlayerId: "anne" }), "anne");
    expect(Object.keys(honour).sort()).toEqual(["description", "glyph", "id", "title"]);
  });
});
