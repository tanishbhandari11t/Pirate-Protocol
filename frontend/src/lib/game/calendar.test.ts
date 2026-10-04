import { describe, expect, it } from "vitest";
import { dayNumber, SEA_CONDITIONS, seaConditionFor, seaForecast } from "./calendar";

const DAY = 86_400_000;
const NOON = Date.parse("2026-10-04T12:00:00.000Z");

describe("the Seven Seas Calendar", () => {
  it("gives every sailor the same condition for the whole UTC day", () => {
    const start = dayNumber(NOON) * DAY;
    expect(seaConditionFor(start)).toBe(seaConditionFor(start + DAY - 1));
    expect(seaConditionFor(new Date(NOON))).toBe(seaConditionFor(NOON));
  });

  it("forecasts consecutive days starting today", () => {
    const week = seaForecast(NOON);
    expect(week).toHaveLength(7);
    expect(week[0].condition).toBe(seaConditionFor(NOON));
    week.forEach((d, i) => expect(d.day).toBe(dayNumber(NOON) + i));
  });

  it("visits every condition over a season, with fair winds most common", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 365; i++) {
      const id = seaConditionFor(NOON + i * DAY).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(Object.keys(SEA_CONDITIONS).sort());
    const fair = counts.get("fair-winds")!;
    for (const [id, n] of counts) if (id !== "fair-winds") expect(fair).toBeGreaterThan(n);
  });
});
