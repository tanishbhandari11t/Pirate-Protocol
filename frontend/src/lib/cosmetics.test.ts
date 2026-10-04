import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAMES,
  DEFAULT_OUTFIT,
  FLAG_BORDERS,
  FLAG_EMBLEMS,
  FLAG_FIELDS,
  OUTFIT_COATS,
  OUTFIT_FACES,
  OUTFIT_HATS,
  OUTFIT_TRINKETS,
  sanitizeOutfit,
  type Outfit,
} from "./socket/contract";
import { ACHIEVEMENTS } from "./game/achievements";
import { careerTotals, type CareerTotals, type VoyageRecord } from "./game/career";
import {
  SLOTS,
  UNLOCKS,
  WARDROBE_SLOTS,
  earnedOutfit,
  isUnlocked,
  newlyUnlocked,
  pieceIn,
  wardrobeProgress,
  wearing,
} from "./cosmetics";

const FRESH: CareerTotals = careerTotals({ voyages: [] });

function totals(voyages: Partial<VoyageRecord>[]): CareerTotals {
  return careerTotals({
    voyages: voyages.map((v, i) => ({
      key: `v${i}`,
      crewName: "Crew",
      recordedAt: 0,
      finishReason: null,
      won: false,
      solved: 0,
      relics: 0,
      strikes: 0,
      eliminated: false,
      honours: [],
      ...v,
    })),
  });
}

describe("catalogue", () => {
  it.each([
    ["hat", OUTFIT_HATS],
    ["coat", OUTFIT_COATS],
    ["face", OUTFIT_FACES],
    ["trinket", OUTFIT_TRINKETS],
    ["frame", AVATAR_FRAMES],
    ["field", FLAG_FIELDS],
    ["emblem", FLAG_EMBLEMS],
    ["border", FLAG_BORDERS],
  ] as const)("describes every %s the contract allows, and nothing else", (slot, ids) => {
    expect([...SLOTS[slot].ids]).toEqual([...ids]);
    expect(Object.keys(SLOTS[slot].catalogue).sort()).toEqual([...ids].sort());
  });

  it("points every piece at an unlock rule that exists", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const id of SLOTS[slot].ids) expect(UNLOCKS).toHaveProperty(SLOTS[slot].catalogue[id].unlock);
    }
  });

  it("leaves something free in every slot, so a new sailor can always dress", () => {
    for (const slot of WARDROBE_SLOTS) {
      expect(SLOTS[slot].ids.some((id) => isUnlocked(slot, id, FRESH))).toBe(true);
    }
  });

  it("lets a new sailor wear plain dress", () => {
    expect(earnedOutfit(DEFAULT_OUTFIT, FRESH)).toEqual(DEFAULT_OUTFIT);
  });
});

describe("unlock rules", () => {
  it("opens counted rewards only once the count is reached", () => {
    expect(isUnlocked("hat", "bicorne", totals([{}, {}]))).toBe(false);
    expect(isUnlocked("hat", "bicorne", totals([{}, {}, {}]))).toBe(true);
    expect(UNLOCKS.threeVoyages.progress(totals([{}, {}]))).toEqual([2, 3]);
  });

  it("caps progress at the goal", () => {
    expect(UNLOCKS.firstVoyage.progress(totals([{}, {}, {}]))).toEqual([1, 1]);
  });

  it("opens honour rewards from the honours the server recorded", () => {
    expect(isUnlocked("trinket", "parrot", FRESH)).toBe(false);
    expect(isUnlocked("trinket", "parrot", totals([{ honours: ["generous"] }]))).toBe(true);
  });

  it("keeps the legend frame for sailors with every honour", () => {
    const allButOne = ACHIEVEMENTS.slice(1).map((a) => a.id);
    expect(isUnlocked("frame", "legend", totals([{ honours: allButOne }]))).toBe(false);
    expect(isUnlocked("frame", "legend", totals([{ honours: ACHIEVEMENTS.map((a) => a.id) }]))).toBe(true);
  });

  it("counts wins, not finishes, for Vault rewards", () => {
    expect(isUnlocked("trinket", "gold-tooth", totals([{ finishReason: "treasure" }]))).toBe(false);
    expect(isUnlocked("trinket", "gold-tooth", totals([{ won: true }]))).toBe(true);
  });

  it("knows nothing about pieces outside the catalogue", () => {
    expect(isUnlocked("hat", "sombrero", totals([{ won: true }]))).toBe(false);
  });
});

describe("wearing", () => {
  const dressed: Outfit = { ...DEFAULT_OUTFIT, hat: "crown", trinket: "parrot" };

  it("changes one slot and leaves the rest", () => {
    expect(wearing(dressed, "coat", "kelp")).toEqual({ ...dressed, coat: "kelp" });
    expect(wearing(dressed, "emblem", "anchor").flag).toEqual({ ...dressed.flag, emblem: "anchor" });
  });

  it("empties optional slots but never the flag", () => {
    expect(wearing(dressed, "hat", null).hat).toBeNull();
    expect(wearing(dressed, "field", null)).toBe(dressed);
  });

  it("always produces an outfit the server would accept", () => {
    let outfit = DEFAULT_OUTFIT;
    for (const slot of WARDROBE_SLOTS) {
      for (const id of SLOTS[slot].ids) {
        outfit = wearing(outfit, slot, id);
        expect(pieceIn(outfit, slot)).toBe(id);
        expect(sanitizeOutfit(outfit)).toEqual(outfit);
      }
    }
  });
});

describe("earnedOutfit", () => {
  it("takes off pieces the sailor has not earned and keeps the rest", () => {
    const outfit: Outfit = {
      hat: "crown",
      coat: "crimson",
      face: "monocle",
      trinket: "hoops",
      frame: "legend",
      flag: { field: "royal", emblem: "kraken", border: "gilded" },
    };
    expect(earnedOutfit(outfit, FRESH)).toEqual({
      hat: null,
      coat: "crimson",
      face: null,
      trinket: "hoops",
      frame: null,
      flag: { field: "sable", emblem: "skull", border: "plain" },
    });
  });
});

describe("newlyUnlocked", () => {
  it("lists what a first voyage opens", () => {
    const opened = newlyUnlocked(FRESH, totals([{}])).map((u) => `${u.slot}:${u.piece.id}`);
    expect(opened).toEqual(expect.arrayContaining(["hat:knit", "coat:kelp", "emblem:anchor", "border:tattered"]));
    expect(opened).not.toContain("hat:tricorn");
  });

  it("lists nothing when nothing changed", () => {
    const same = totals([{ won: true }]);
    expect(newlyUnlocked(same, same)).toEqual([]);
  });
});

describe("wardrobeProgress", () => {
  it("counts every piece once", () => {
    const { open, total } = wardrobeProgress(FRESH);
    const pieces = WARDROBE_SLOTS.reduce((sum, slot) => sum + SLOTS[slot].ids.length, 0);
    expect(total).toBe(pieces);
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThan(total);
  });
});
