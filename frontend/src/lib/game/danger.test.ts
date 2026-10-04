import { describe, expect, it } from "vitest";
import { publicPlayer, roomState } from "@/test/crew-fixtures";
import { dangerFor, trapZones } from "./danger";

const ALL = new Set(["port-royal", "blackreef", "serpent-cay", "deadmans-shelf", "widows-rock", "kraken-shoal", "goldmouth"]);

const at = (islandKey: string, overrides = {}) =>
  roomState({ players: [publicPlayer("anne", "Anne Bonny", { currentIslandKey: islandKey, ...overrides })] });

describe("trapZones", () => {
  it("only marks trap islands the crew has charted", () => {
    const zones = trapZones(roomState(), new Set(["port-royal", "deadmans-shelf"]), "anne");
    expect(zones.map((z) => z.key)).toEqual(["deadmans-shelf"]);
  });

  it("marks a trap island as spent once this sailor has beaten its riddle", () => {
    const room = roomState({ progress: [{ playerId: "anne", puzzleKey: "deadman-plaque" }] });
    const [zone] = trapZones(room, ALL, "anne").filter((z) => z.key === "deadmans-shelf");
    expect(zone.spent).toBe(true);
    const [other] = trapZones(room, ALL, "jack").filter((z) => z.key === "deadmans-shelf");
    expect(other.spent).toBe(false);
  });
});

describe("dangerFor", () => {
  it("is calm in safe, charted waters", () => {
    const danger = dangerFor({ room: at("port-royal"), meId: "anne", charted: ALL, sea: "calm", kraken: false });
    expect(danger.level).toBe(0);
    expect(danger.reasons).toEqual([]);
    expect(danger.tint).toBe("#1f5566");
  });

  it("darkens most when anchored at an unbeaten trap island", () => {
    const danger = dangerFor({ room: at("deadmans-shelf"), meId: "anne", charted: ALL, sea: "calm", kraken: false });
    expect(danger.reasons).toContain("anchored-at-trap");
    expect(danger.level).toBeCloseTo(0.4);
  });

  it("darkens a little near a charted trap island", () => {
    const danger = dangerFor({ room: at("serpent-cay"), meId: "anne", charted: ALL, sea: "calm", kraken: false });
    expect(danger.reasons).toEqual(["trap-nearby"]);
    expect(danger.level).toBeGreaterThan(0);
    expect(danger.level).toBeLessThan(0.4);
  });

  it("does not warn about traps the crew has not charted yet", () => {
    const charted = new Set(["port-royal", "serpent-cay"]);
    const danger = dangerFor({ room: at("serpent-cay"), meId: "anne", charted, sea: "calm", kraken: false });
    expect(danger.level).toBe(0);
  });

  it("adds strikes, the kraken and the storm together, capped at 1", () => {
    const room = at("deadmans-shelf", { strikes: 2 });
    const danger = dangerFor({ room, meId: "anne", charted: ALL, sea: "tempest", kraken: true });
    expect(danger.reasons).toEqual(["anchored-at-trap", "wounded", "kraken", "tempest"]);
    expect(danger.level).toBe(1);
    expect(danger.tint).toBe("#4a1820");
  });

  it("ignores personal danger for a sailor the sea has already claimed", () => {
    const room = at("deadmans-shelf", { isEliminated: true, strikes: 3 });
    const danger = dangerFor({ room, meId: "anne", charted: ALL, sea: "squall", kraken: false });
    expect(danger.reasons).toEqual(["squall"]);
  });
});
