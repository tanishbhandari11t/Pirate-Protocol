import { describe, expect, it } from "vitest";
import { gameEvent, roomState } from "@/test/crew-fixtures";
import { captainsLogText, formatVoyageClock, MAX_CHAPTERS, narrateEvent, writeCaptainsLog } from "./captainsLog";

const voyageLog = [
  gameEvent(1, "PLAYER_JOINED", "anne"),
  gameEvent(2, "MOVED", "anne", { islandKey: "port-royal" }),
  gameEvent(3, "PUZZLE_SOLVED", "anne", { puzzleKey: "port-royal-map" }),
  gameEvent(4, "ITEM_GRANTED", "anne", { itemKey: "compass", quantity: 1 }),
  gameEvent(5, "ISLAND_DISCOVERED", "jack", { islandKey: "blackreef" }),
  gameEvent(6, "TRAP_TRIGGERED", "jack", { puzzleKey: "deadman-plaque", strikes: 1, eliminated: false }),
  gameEvent(7, "ITEM_GRANTED", "jack", { itemKey: "cursed-coin", quantity: 1 }),
  gameEvent(8, "TRADED", "anne", { itemKey: "tide-rumor", quantity: 1, fromPlayerId: "anne", toPlayerId: "jack" }),
  gameEvent(9, "PUZZLE_SOLVED", "jack", { puzzleKey: "blackreef-cipher" }),
];

describe("writeCaptainsLog", () => {
  it("tells only story-worthy events, in order, with voyage clocks", () => {
    const log = writeCaptainsLog(roomState({ log: voyageLog }));
    expect(log.chapters.map((c) => c.id)).toEqual(["evt-3", "evt-4", "evt-5", "evt-6", "evt-7", "evt-8", "evt-9"]);
    expect(log.chapters[0].clock).toBe("00:01");
    expect(log.chapters.at(-1)!.clock).toBe("00:07");
  });

  it("marks the first solve of the voyage as the start of the hunt", () => {
    const [first] = writeCaptainsLog(roomState({ log: voyageLog })).chapters;
    expect(first.text).toBe("Anne Bonny cracked the first riddle of the voyage, at Port Royal. The hunt was on.");
    expect(first.mood).toBe("triumph");
  });

  it("speaks to the reader as You and conjugates for it", () => {
    const log = writeCaptainsLog(roomState({ log: voyageLog }), "jack");
    const curse = log.chapters.find((c) => c.id === "evt-7")!;
    expect(curse.text).toMatch(/^You were handed a Cursed Coin/);
    expect(curse.mood).toBe("peril");
  });

  it("is deterministic for the same voyage", () => {
    const room = roomState({ log: voyageLog });
    expect(captainsLogText(writeCaptainsLog(room))).toBe(captainsLogText(writeCaptainsLog(room)));
  });

  it("names the trade as intrigue between both sailors", () => {
    const trade = writeCaptainsLog(roomState({ log: voyageLog })).chapters.find((c) => c.id === "evt-8")!;
    expect(trade.mood).toBe("intrigue");
    expect(trade.text).toContain("Anne Bonny");
    expect(trade.text).toContain("Calico Jack");
  });

  it("trims long voyages but always keeps the finale", () => {
    const noisy = Array.from({ length: 40 }, (_, i) => gameEvent(i + 1, "PUZZLE_FAILED", "jack", { puzzleKey: "blackreef-cipher" }));
    const room = roomState({
      log: [...noisy, gameEvent(41, "TREASURE_FOUND", "anne", { puzzleKey: "vault-protocol" })],
      finishReason: "treasure",
      winnerPlayerId: "anne",
    });
    const log = writeCaptainsLog(room);
    expect(log.chapters).toHaveLength(MAX_CHAPTERS);
    expect(log.chapters.at(-1)!.text).toContain("the Vault swung open");
    expect(log.epilogue).toMatch(/^Anne Bonny came home with the hoard/);
  });

  it("writes a prologue naming the whole crew and an epilogue per ending", () => {
    const room = roomState();
    expect(writeCaptainsLog(room).prologue).toBe(
      "Anne Bonny and Calico Jack left Port Royal aboard The Black Gull, chasing a Vault that should not exist.",
    );
    expect(writeCaptainsLog({ ...room, finishReason: "wreck" }).epilogue).toMatch(/^No sailor came home/);
    expect(writeCaptainsLog({ ...room, finishReason: null }).epilogue).toMatch(/still under sail/);
  });

  it("never invents islands: unknown keys become an unknown shore", () => {
    const room = roomState({ log: [gameEvent(1, "ISLAND_DISCOVERED", "anne", { islandKey: "atlantis" })] });
    expect(writeCaptainsLog(room).chapters[0].text).toContain("an unknown shore");
  });
});

describe("narrateEvent", () => {
  const room = roomState({ log: voyageLog });

  it("tells a live event with the same words the log would use", () => {
    const solved = narrateEvent(room, null, voyageLog[2])!;
    expect(solved.text).toBe(writeCaptainsLog(room).chapters[0].text);
    expect(solved.mood).toBe("triumph");
  });

  it("knows which firsts already happened earlier in the voyage", () => {
    const second = narrateEvent(room, null, voyageLog[8])!;
    expect(second.text).not.toContain("first riddle");
  });

  it("stays quiet for routine comings and goings", () => {
    expect(narrateEvent(room, null, voyageLog[0])).toBeNull();
    expect(narrateEvent(room, null, voyageLog[1])).toBeNull();
  });
});

describe("formatVoyageClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatVoyageClock(0)).toBe("00:00");
    expect(formatVoyageClock(754_000)).toBe("12:34");
    expect(formatVoyageClock(-5)).toBe("00:00");
  });
});
