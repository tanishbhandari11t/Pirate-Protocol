/**
 * The in-game time of day, read from the voyage clock. Timed voyages run from dawn to midnight
 * over their allotted time; untimed ones turn a full day every `DAY_MS`. Nothing here affects play.
 */

/** One noon-to-noon cycle on untimed voyages. */
export const DAY_MS = 16 * 60_000;
/** Timed voyages set sail at first light and the clock runs out at midnight. */
export const TIMED_START_HOUR = 6;
export const TIMED_END_HOUR = 24;
/** Untimed voyages begin mid-morning. */
export const UNTIMED_START_HOUR = 9;

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export interface Sky {
  /** 0 ≤ hour < 24. */
  hour: number;
  phase: SkyPhase;
  /** −1 at midnight, 1 at noon. */
  sunAltitude: number;
  /** 0 in full daylight, 1 in the dead of night. */
  darkness: number;
  /** How visible the stars are, 0–1. */
  stars: number;
  /** Gradient stops for the sky, top to horizon. */
  top: string;
  middle: string;
  horizon: string;
  /** The sea's colour under this sky, before weather and danger. */
  sea: string;
  label: string;
}

export interface ClockInput {
  /** Epoch ms when the ships left harbour. */
  startedAt: number;
  /** Epoch ms when a timed voyage ends, or `null`. */
  endsAt: number | null;
  /** Epoch ms now, or when the voyage finished so the sky freezes with the result. */
  now: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const wrap24 = (h: number) => ((h % 24) + 24) % 24;

export function voyageHour({ startedAt, endsAt, now }: ClockInput): number {
  const elapsed = Math.max(0, now - startedAt);
  if (endsAt !== null && endsAt > startedAt) {
    const progress = clamp01(elapsed / (endsAt - startedAt));
    return wrap24(TIMED_START_HOUR + (TIMED_END_HOUR - TIMED_START_HOUR) * progress);
  }
  return wrap24(UNTIMED_START_HOUR + (elapsed / DAY_MS) * 24);
}

/** Sky colours at key hours; anything between is blended. */
const KEYS: { hour: number; top: string; middle: string; horizon: string; sea: string }[] = [
  { hour: 0, top: "#02050b", middle: "#06101d", horizon: "#0c1a2a", sea: "#06131c" },
  { hour: 4.5, top: "#050a17", middle: "#0d1a30", horizon: "#1c2a44", sea: "#0a1b26" },
  { hour: 6, top: "#1b2440", middle: "#5a4a6a", horizon: "#e4936a", sea: "#173445" },
  { hour: 7.5, top: "#3a6a96", middle: "#8fb3c9", horizon: "#f2d29a", sea: "#1f4e63" },
  { hour: 12, top: "#3d7fb4", middle: "#86bcd8", horizon: "#d8ecf0", sea: "#246379" },
  { hour: 16.5, top: "#3a6f9f", middle: "#a3b9c4", horizon: "#f0d7a2", sea: "#215a6e" },
  { hour: 18.5, top: "#2a2f55", middle: "#8a4f63", horizon: "#f08a4b", sea: "#1b3a4c" },
  { hour: 20, top: "#0d1430", middle: "#2a2a4f", horizon: "#5a3a4f", sea: "#0f2533" },
  { hour: 22, top: "#03070f", middle: "#08121f", horizon: "#13213a", sea: "#081822" },
  { hour: 24, top: "#02050b", middle: "#06101d", horizon: "#0c1a2a", sea: "#06131c" },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blends two `#rrggbb` colours; `t` = 0 gives `a`. */
export function mixColor(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const k = clamp01(t);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

function phaseOf(hour: number, altitude: number): SkyPhase {
  if (altitude > 0.3) return "day";
  if (altitude > -0.35) return hour < 12 ? "dawn" : "dusk";
  return "night";
}

const LABEL: Record<SkyPhase, string> = {
  dawn: "First light",
  day: "Broad day",
  dusk: "Dusk",
  night: "Night watch",
};

export function skyAt(hour: number): Sky {
  const h = wrap24(hour);
  const sunAltitude = -Math.cos((h / 24) * Math.PI * 2);
  const darkness = clamp01((0.25 - sunAltitude) / 0.95);
  const i = Math.max(0, KEYS.findIndex((k) => k.hour > h) - 1);
  const from = KEYS[i];
  const to = KEYS[i + 1] ?? KEYS[i];
  const t = to.hour === from.hour ? 0 : (h - from.hour) / (to.hour - from.hour);
  const phase = phaseOf(h, sunAltitude);
  return {
    hour: h,
    phase,
    sunAltitude,
    darkness,
    stars: clamp01((darkness - 0.45) / 0.45),
    top: mixColor(from.top, to.top, t),
    middle: mixColor(from.middle, to.middle, t),
    horizon: mixColor(from.horizon, to.horizon, t),
    sea: mixColor(from.sea, to.sea, t),
    label: LABEL[phase],
  };
}

export function skyFor(clock: ClockInput): Sky {
  return skyAt(voyageHour(clock));
}

/** The ship's clock, as `HH:MM`. */
export function formatHour(hour: number) {
  const h = Math.floor(wrap24(hour));
  const m = Math.floor((wrap24(hour) - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
