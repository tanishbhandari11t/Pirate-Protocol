import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT, fittedGear, parseLayout } from "./gear";

describe("fittedGear", () => {
  it("keeps tools the sailor still holds", () => {
    expect(fittedGear({ gear: { helm: "compass", glass: "spyglass" }, order: [] }, new Set(["compass", "spyglass"]))).toEqual({
      helm: "compass",
      glass: "spyglass",
    });
  });

  it("unfits a tool that has left the hold", () => {
    expect(fittedGear({ gear: { helm: "compass" }, order: [] }, new Set())).toEqual({});
  });

  it("refuses a tool in the wrong slot", () => {
    expect(fittedGear({ gear: { glass: "compass" }, order: [] }, new Set(["compass"]))).toEqual({});
  });
});

describe("parseLayout", () => {
  it("recovers from missing or hand-edited storage", () => {
    expect(parseLayout(null)).toEqual(EMPTY_LAYOUT);
    expect(parseLayout("nonsense")).toEqual(EMPTY_LAYOUT);
    expect(parseLayout({ gear: { helm: 4, glass: "spyglass", deck: "x" }, order: ["a", 2, "b"] })).toEqual({
      gear: { glass: "spyglass" },
      order: ["a", "b"],
    });
  });
});
