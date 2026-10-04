import { describe, expect, it } from "vitest";
import { publicPlayer, roomState } from "@/test/crew-fixtures";
import { ACHIEVEMENTS } from "./achievements";
import {
  CAREER_LIMIT,
  EMPTY_CAREER,
  careerTotals,
  isLegend,
  parseCareer,
  voyageKey,
  voyageRecord,
  withVoyage,
  type VoyageRecord,
} from "./career";

const ALL_RELIC_PUZZLES = ["port-royal-map", "blackreef-cipher", "serpent-anagram", "widow-riddle", "goldmouth-tides"];

function record(overrides: Partial<VoyageRecord> = {}): VoyageRecord {
  return {
    key: "ABC234:2026-10-03T12:00:00.000Z",
    crewName: "The Black Gull",
    recordedAt: 0,
    finishReason: "treasure",
    won: false,
    solved: 0,
    relics: 0,
    strikes: 0,
    eliminated: false,
    honours: [],
    ...overrides,
  };
}

describe("voyageRecord", () => {
  it("writes nothing while the voyage is still at sea", () => {
    expect(voyageRecord(roomState(), "anne")).toBeNull();
  });

  it("writes nothing for a sailor who is not on the manifest", () => {
    expect(voyageRecord(roomState({ status: "FINISHED" }), "mary")).toBeNull();
  });

  it("copies the winner, solves, relics and honours from the finished voyage", () => {
    const room = roomState({
      status: "FINISHED",
      finishReason: "treasure",
      winnerPlayerId: "anne",
      progress: ALL_RELIC_PUZZLES.map((puzzleKey) => ({ playerId: "anne", puzzleKey })),
    });
    const entry = voyageRecord(room, "anne", 42)!;
    expect(entry).toMatchObject({
      key: voyageKey(room),
      crewName: "The Black Gull",
      recordedAt: 42,
      finishReason: "treasure",
      won: true,
      solved: 5,
      relics: 5,
      strikes: 0,
      eliminated: false,
    });
    expect(entry.honours).toEqual(expect.arrayContaining(["vault-breaker", "relic-hunter", "unbroken"]));
  });

  it("records a lost sailor's strikes without inventing a win", () => {
    const room = roomState({
      status: "FINISHED",
      finishReason: "wreck",
      players: [publicPlayer("anne", "Anne Bonny", { strikes: 3, isEliminated: true })],
    });
    expect(voyageRecord(room, "anne")).toMatchObject({ won: false, strikes: 3, eliminated: true, honours: ["ghost"] });
  });
});

describe("withVoyage", () => {
  it("puts the newest voyage first", () => {
    const career = withVoyage(withVoyage(EMPTY_CAREER, record({ key: "a" })), record({ key: "b" }));
    expect(career.voyages.map((v) => v.key)).toEqual(["b", "a"]);
  });

  it("ignores a voyage it already holds and returns the same career", () => {
    const once = withVoyage(EMPTY_CAREER, record());
    expect(withVoyage(once, record({ won: true }))).toBe(once);
  });

  it("forgets the oldest voyages beyond the limit", () => {
    let career = EMPTY_CAREER;
    for (let i = 0; i < CAREER_LIMIT + 5; i++) career = withVoyage(career, record({ key: `v${i}` }));
    expect(career.voyages).toHaveLength(CAREER_LIMIT);
    expect(career.voyages[0].key).toBe(`v${CAREER_LIMIT + 4}`);
  });
});

describe("careerTotals", () => {
  it("adds up voyages, wins, solves and relics", () => {
    const career = {
      voyages: [
        record({ key: "a", won: true, solved: 5, relics: 5 }),
        record({ key: "b", solved: 2, relics: 1, strikes: 1 }),
        record({ key: "c" }),
      ],
    };
    const totals = careerTotals(career);
    expect(totals).toMatchObject({ voyages: 3, wins: 1, solved: 7, relics: 6, fullHolds: 1, spotless: 1 });
  });

  it("does not count a voyage with no solves as spotless", () => {
    expect(careerTotals({ voyages: [record({ solved: 0, strikes: 0 })] }).spotless).toBe(0);
  });

  it("collects each honour once, however often it was earned", () => {
    const totals = careerTotals({
      voyages: [record({ key: "a", honours: ["ghost", "generous"] }), record({ key: "b", honours: ["ghost"] })],
    });
    expect([...totals.honours].sort()).toEqual(["generous", "ghost"]);
  });
});

describe("isLegend", () => {
  it("needs every honour in the book", () => {
    const every = ACHIEVEMENTS.map((a) => a.id);
    expect(isLegend(careerTotals({ voyages: [record({ honours: every })] }))).toBe(true);
    expect(isLegend(careerTotals({ voyages: [record({ honours: every.slice(1) })] }))).toBe(false);
  });
});

describe("parseCareer", () => {
  it.each([null, undefined, 3, "career", {}, { voyages: "many" }])("falls back to an empty career for %p", (value) => {
    expect(parseCareer(value)).toEqual(EMPTY_CAREER);
  });

  it("keeps well-formed voyages and drops tampered ones", () => {
    const good = record({ key: "good" });
    const career = parseCareer({ voyages: [good, { key: "bad", won: "yes" }, null, { ...good, solved: Number.NaN }] });
    expect(career.voyages).toEqual([good]);
  });
});
