import { describe, expect, it } from "vitest";
import { DAY_MS, formatHour, mixColor, skyAt, skyFor, voyageHour } from "./sky";

const T0 = 1_000_000;
const MIN = 60_000;

describe("voyageHour", () => {
  it("starts a timed voyage at dawn and ends it at midnight", () => {
    const endsAt = T0 + 20 * MIN;
    expect(voyageHour({ startedAt: T0, endsAt, now: T0 })).toBe(6);
    expect(voyageHour({ startedAt: T0, endsAt, now: T0 + 10 * MIN })).toBe(15);
    expect(voyageHour({ startedAt: T0, endsAt, now: endsAt })).toBe(0);
  });

  it("holds at midnight once a timed voyage's clock has run out", () => {
    expect(voyageHour({ startedAt: T0, endsAt: T0 + MIN, now: T0 + 5 * MIN })).toBe(0);
  });

  it("turns a full day every DAY_MS on an untimed voyage, starting mid-morning", () => {
    expect(voyageHour({ startedAt: T0, endsAt: null, now: T0 })).toBe(9);
    expect(voyageHour({ startedAt: T0, endsAt: null, now: T0 + DAY_MS / 8 })).toBe(12);
    expect(voyageHour({ startedAt: T0, endsAt: null, now: T0 + DAY_MS })).toBeCloseTo(9);
  });

  it("never runs backwards before the ships leave harbour", () => {
    expect(voyageHour({ startedAt: T0, endsAt: null, now: T0 - 5 * MIN })).toBe(9);
  });
});

describe("skyAt", () => {
  it("is brightest at noon and darkest at midnight", () => {
    expect(skyAt(12).darkness).toBe(0);
    expect(skyAt(0).darkness).toBe(1);
    expect(skyAt(12).sunAltitude).toBeCloseTo(1);
    expect(skyAt(0).sunAltitude).toBeCloseTo(-1);
  });

  it("names the phase of the day", () => {
    expect(skyAt(6).phase).toBe("dawn");
    expect(skyAt(12).phase).toBe("day");
    expect(skyAt(18).phase).toBe("dusk");
    expect(skyAt(1).phase).toBe("night");
  });

  it("only shows stars once it is properly dark", () => {
    expect(skyAt(12).stars).toBe(0);
    expect(skyAt(0).stars).toBe(1);
  });

  it("blends the palette smoothly between key hours", () => {
    const a = skyAt(11.9).top;
    const b = skyAt(12).top;
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(a).not.toBe("#000000");
    expect(Math.abs(parseInt(a.slice(1), 16) - parseInt(b.slice(1), 16))).toBeLessThan(0x030303);
  });

  it("wraps hours outside the day", () => {
    expect(skyAt(36).hour).toBe(12);
    expect(skyAt(-6).hour).toBe(18);
  });
});

describe("skyFor", () => {
  it("reads the sky straight from the voyage clock", () => {
    expect(skyFor({ startedAt: T0, endsAt: null, now: T0 + DAY_MS / 8 }).phase).toBe("day");
  });
});

describe("mixColor", () => {
  it("returns each end and the midpoint", () => {
    expect(mixColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("clamps out-of-range blends", () => {
    expect(mixColor("#102030", "#405060", 2)).toBe("#405060");
  });
});

describe("formatHour", () => {
  it("reads like a ship's clock", () => {
    expect(formatHour(6.5)).toBe("06:30");
    expect(formatHour(23.99)).toBe("23:59");
  });
});
