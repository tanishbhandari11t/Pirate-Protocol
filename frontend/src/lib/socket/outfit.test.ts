import { describe, expect, it } from "vitest";
import { DEFAULT_OUTFIT, outfitsEqual, sanitizeOutfit, type Outfit } from "./contract";

const DRESSED: Outfit = {
  hat: "plumed",
  coat: "royal",
  face: "monocle",
  trinket: "parrot",
  frame: "gold",
  flag: { field: "crimson", emblem: "kraken", border: "tattered" },
};

describe("sanitizeOutfit", () => {
  it("accepts plain dress and a full outfit unchanged", () => {
    expect(sanitizeOutfit(DEFAULT_OUTFIT)).toEqual(DEFAULT_OUTFIT);
    expect(sanitizeOutfit(DRESSED)).toEqual(DRESSED);
  });

  it("returns a copy rather than the object it was given", () => {
    const clean = sanitizeOutfit(DRESSED)!;
    expect(clean).not.toBe(DRESSED);
    expect(clean.flag).not.toBe(DRESSED.flag);
  });

  it("treats missing slots as empty", () => {
    expect(sanitizeOutfit({ flag: DEFAULT_OUTFIT.flag })).toEqual(DEFAULT_OUTFIT);
  });

  it("drops keys the tailor does not know", () => {
    const clean = sanitizeOutfit({ ...DRESSED, cape: "velvet", flag: { ...DRESSED.flag, tassels: 4 } });
    expect(clean).toEqual(DRESSED);
  });

  it.each([
    ["an unknown hat", { ...DRESSED, hat: "sombrero" }],
    ["an unknown coat", { ...DRESSED, coat: "tweed" }],
    ["an unknown face mark", { ...DRESSED, face: "tattoo" }],
    ["an unknown trinket", { ...DRESSED, trinket: "hook" }],
    ["an unknown frame", { ...DRESSED, frame: "diamond" }],
    ["a non-string piece", { ...DRESSED, hat: 3 }],
    ["an unknown flag colour", { ...DRESSED, flag: { ...DRESSED.flag, field: "pink" } }],
    ["an unknown emblem", { ...DRESSED, flag: { ...DRESSED.flag, emblem: "rose" } }],
    ["an unknown hem", { ...DRESSED, flag: { ...DRESSED.flag, border: "lace" } }],
    ["a missing flag", { ...DRESSED, flag: undefined }],
    ["a flag that is not an object", { ...DRESSED, flag: "skull" }],
  ])("rejects %s", (_label, value) => {
    expect(sanitizeOutfit(value)).toBeNull();
  });

  it.each([null, undefined, "captain", 7, []])("rejects %p", (value) => {
    expect(sanitizeOutfit(value)).toBeNull();
  });
});

describe("outfitsEqual", () => {
  it("compares every slot and every part of the flag", () => {
    expect(outfitsEqual(DRESSED, { ...DRESSED, flag: { ...DRESSED.flag } })).toBe(true);
    expect(outfitsEqual(DRESSED, { ...DRESSED, hat: null })).toBe(false);
    expect(outfitsEqual(DRESSED, { ...DRESSED, flag: { ...DRESSED.flag, border: "plain" } })).toBe(false);
  });
});
