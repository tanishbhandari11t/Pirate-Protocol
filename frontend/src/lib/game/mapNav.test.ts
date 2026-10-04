import { describe, expect, it } from "vitest";
import { edgeIsland, nearestInDirection, type NavPoint } from "./mapNav";

const chart: NavPoint[] = [
  { key: "home", x: 50, y: 50 },
  { key: "east", x: 80, y: 52 },
  { key: "far-east", x: 120, y: 50 },
  { key: "north", x: 50, y: 10 },
  { key: "north-east-steep", x: 60, y: 0 },
  { key: "south-west", x: 20, y: 90 },
];

describe("nearestInDirection", () => {
  it("picks the closest island ahead", () => {
    expect(nearestInDirection(chart, "home", "right")).toBe("east");
    expect(nearestInDirection(chart, "east", "right")).toBe("far-east");
  });

  it("prefers straight ahead over closer but sideways islands", () => {
    expect(nearestInDirection(chart, "home", "up")).toBe("north");
  });

  it("ignores islands behind or outside the cone", () => {
    expect(nearestInDirection(chart, "far-east", "right")).toBeNull();
    expect(nearestInDirection(chart, "north", "down")).toBe("home");
  });

  it("starts from the first island when focus is unknown", () => {
    expect(nearestInDirection(chart, "nowhere", "left")).toBe("home");
    expect(nearestInDirection([], "nowhere", "left")).toBeNull();
  });
});

describe("edgeIsland", () => {
  it("returns the first and last islands", () => {
    expect(edgeIsland(chart, "first")).toBe("home");
    expect(edgeIsland(chart, "last")).toBe("south-west");
    expect(edgeIsland([], "first")).toBeNull();
  });
});
