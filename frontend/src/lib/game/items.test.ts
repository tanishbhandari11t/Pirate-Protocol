import { describe, expect, it } from "vitest";
import { ITEM_KEYS, SCORE_RULES, type InventoryItem } from "../socket/contract";
import {
  arrangeHold,
  compareItems,
  gearSlotFor,
  HOLD_BERTHS,
  itemAbilities,
  moveBerth,
  profileOf,
} from "./items";

const HINTS_ON = { hintsEnabled: true };
const HINTS_OFF = { hintsEnabled: false };
const item = (itemKey: string, quantity = 1): InventoryItem => ({ itemKey, name: itemKey, description: "", quantity });
const kinds = (key: string, settings = HINTS_ON) => itemAbilities(key, settings).map((a) => a.kind);

describe("itemAbilities", () => {
  it("describes relics by the Vault's rule, the score table and the trade ban", () => {
    expect(kinds("serpent-key")).toEqual(["vault", "score", "bound"]);
    expect(itemAbilities("serpent-key", HINTS_ON)[1].label).toBe(`+${SCORE_RULES.perRelic} points`);
  });

  it("adds the gear slot for navigation tools", () => {
    expect(kinds("compass")).toEqual(["vault", "score", "bound", "gear"]);
    expect(kinds("spyglass")).toContain("gear");
    expect(kinds("widow-chart")).toContain("gear");
    expect(kinds("gold-seal")).not.toContain("gear");
  });

  it("only offers a tide rumor as hint payment when hints are allowed", () => {
    expect(kinds("tide-rumor", HINTS_ON)).toEqual(["hint", "trade"]);
    expect(kinds("tide-rumor", HINTS_OFF)).toEqual(["trade"]);
  });

  it("gives the cursed coin no invented power", () => {
    expect(kinds("cursed-coin")).toEqual(["curse", "trade"]);
  });

  it("values the chest at the treasure bonus", () => {
    expect(itemAbilities("treasure-chest", HINTS_ON)).toEqual([
      expect.objectContaining({ kind: "treasure", label: `+${SCORE_RULES.treasure} points` }),
    ]);
  });

  it("knows nothing about items the server never mentioned", () => {
    expect(itemAbilities("mystery-box", HINTS_ON)).toEqual([]);
  });
});

describe("gearSlotFor", () => {
  it("fits compass and chart at the helm and the spyglass at the lookout", () => {
    expect(gearSlotFor("compass")).toBe("helm");
    expect(gearSlotFor("widow-chart")).toBe("helm");
    expect(gearSlotFor("spyglass")).toBe("glass");
    expect(gearSlotFor("tide-rumor")).toBeNull();
  });
});

describe("HOLD_BERTHS", () => {
  it("has one berth for every kind of item", () => {
    expect(HOLD_BERTHS).toBe(ITEM_KEYS.length);
  });
});

describe("compareItems", () => {
  it("marks which side wins each row", () => {
    const rows = compareItems(profileOf(item("compass"), HINTS_ON), profileOf(item("tide-rumor", 3), HINTS_ON));
    const row = (label: string) => rows.find((r) => r.label === label)!;
    expect(row("Rarity").better).toBe("left");
    expect(row("Opens the Vault").better).toBe("left");
    expect(row("Pays for hints").better).toBe("right");
    expect(row("Tradeable")).toMatchObject({ left: "No", right: "Yes", better: null });
    expect(row("Gear slot")).toMatchObject({ left: "Helm", right: "None", better: "left" });
    expect(row("Held").better).toBe("right");
  });
});

describe("arrangeHold", () => {
  it("follows the saved order and puts new arrivals last by rarity", () => {
    const hold = [item("cursed-coin"), item("tide-rumor"), item("compass"), item("spyglass")];
    expect(arrangeHold(hold, ["tide-rumor", "compass"]).map((i) => i.itemKey)).toEqual([
      "tide-rumor",
      "compass",
      "spyglass",
      "cursed-coin",
    ]);
  });

  it("ignores saved keys that are no longer held", () => {
    expect(arrangeHold([item("compass")], ["spyglass", "compass"]).map((i) => i.itemKey)).toEqual(["compass"]);
  });
});

describe("moveBerth", () => {
  it("moves a key to a new index", () => {
    expect(moveBerth(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveBerth(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("adds keys not yet in the order and clamps the index", () => {
    expect(moveBerth(["a"], "z", 9)).toEqual(["a", "z"]);
    expect(moveBerth(["a", "b"], "b", -3)).toEqual(["b", "a"]);
  });
});
