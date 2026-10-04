import { describe, expect, it } from "vitest";
import { addMark, cleanMarkRequest, fitRoute, liveMarks, MARK_LIMITS, routeLength, simplifyRoute, type MapMark } from "./marks";

const mark = (id: string, playerId: string, createdAt: number, ttl: number = MARK_LIMITS.ttlMs): MapMark => ({
  id,
  playerId,
  kind: "pin",
  points: [{ x: 10, y: 10 }],
  createdAt,
  expiresAt: createdAt + ttl,
});

describe("cleanMarkRequest", () => {
  it("accepts a single-point stamp and snaps it to half units", () => {
    expect(cleanMarkRequest({ kind: "danger", points: [{ x: 12.34, y: 99.9 }] })).toEqual({
      kind: "danger",
      points: [{ x: 12.5, y: 100 }],
    });
  });

  it("clamps points onto the grid", () => {
    expect(cleanMarkRequest({ kind: "pin", points: [{ x: -40, y: 400 }] })!.points).toEqual([{ x: 0, y: 100 }]);
  });

  it("rejects unknown kinds, bad points and multi-point stamps", () => {
    expect(cleanMarkRequest({ kind: "cannon", points: [{ x: 1, y: 1 }] })).toBeNull();
    expect(cleanMarkRequest({ kind: "pin", points: [{ x: Number.NaN, y: 1 }] })).toBeNull();
    expect(cleanMarkRequest({ kind: "pin", points: [{ x: "1", y: 1 }] })).toBeNull();
    expect(cleanMarkRequest({ kind: "pin", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })).toBeNull();
    expect(cleanMarkRequest(null)).toBeNull();
    expect(cleanMarkRequest({ kind: "pin" })).toBeNull();
  });

  it("requires routes to be long enough and within the point budget", () => {
    expect(cleanMarkRequest({ kind: "route", points: [{ x: 1, y: 1 }, { x: 2, y: 1 }] })).toBeNull();
    expect(cleanMarkRequest({ kind: "route", points: [{ x: 1, y: 1 }, { x: 30, y: 1 }] })).not.toBeNull();
    const tooMany = Array.from({ length: MARK_LIMITS.routePoints + 1 }, (_, i) => ({ x: i * 3, y: i % 2 }));
    expect(cleanMarkRequest({ kind: "route", points: tooMany })).toBeNull();
  });
});

describe("route simplification", () => {
  it("drops points on a straight line", () => {
    const line = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i }));
    expect(simplifyRoute(line)).toEqual([{ x: 0, y: 0 }, { x: 19, y: 19 }]);
  });

  it("keeps a corner", () => {
    const corner = [...Array.from({ length: 10 }, (_, i) => ({ x: i * 2, y: 0 })), ...Array.from({ length: 10 }, (_, i) => ({ x: 18, y: (i + 1) * 2 }))];
    expect(simplifyRoute(corner)).toEqual([{ x: 0, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 20 }]);
  });

  it("always fits the budget", () => {
    const zigzag = Array.from({ length: 300 }, (_, i) => ({ x: i / 3, y: (i % 2) * 6 }));
    const fitted = fitRoute(zigzag);
    expect(fitted.length).toBeLessThanOrEqual(MARK_LIMITS.routePoints);
    expect(fitted[0]).toEqual(zigzag[0]);
    expect(fitted.at(-1)).toEqual(zigzag.at(-1));
  });

  it("measures length", () => {
    expect(routeLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });
});

describe("mark bookkeeping", () => {
  it("drops expired marks and sorts oldest first", () => {
    const marks = [mark("b", "anne", 200), mark("a", "anne", 100), mark("old", "anne", 0, 50)];
    expect(liveMarks(marks, 150).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("retires a sailor's oldest mark past the limit without touching crewmates", () => {
    let marks: MapMark[] = [mark("jack-1", "jack", 0)];
    for (let i = 0; i < MARK_LIMITS.perSailor; i++) marks = addMark(marks, mark(`anne-${i}`, "anne", i + 1), 10);
    marks = addMark(marks, mark("anne-new", "anne", 99), 100);
    const anne = marks.filter((m) => m.playerId === "anne").map((m) => m.id);
    expect(anne).toHaveLength(MARK_LIMITS.perSailor);
    expect(anne).not.toContain("anne-0");
    expect(anne.at(-1)).toBe("anne-new");
    expect(marks.some((m) => m.id === "jack-1")).toBe(true);
  });
});
