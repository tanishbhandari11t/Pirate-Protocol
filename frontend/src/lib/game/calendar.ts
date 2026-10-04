/**
 * The Seven Seas Calendar: one world condition per UTC day, the same for every player because it
 * is derived from the date alone. Conditions currently change how the world looks and feels;
 * reward or rule changes belong on the server, which can import this same rotation.
 */

export type SeaConditionId = "ghost-moon" | "golden-tide" | "bloodstorm" | "silent-waters" | "fair-winds";

export interface SeaCondition {
  id: SeaConditionId;
  name: string;
  glyph: string;
  /** One line for banners. */
  tagline: string;
  /** What actually changes today, stated plainly. */
  effect: string;
}

export const SEA_CONDITIONS: Record<SeaConditionId, SeaCondition> = {
  "ghost-moon": {
    id: "ghost-moon",
    name: "Ghost Moon",
    glyph: "☾",
    tagline: "The dead sail tonight.",
    effect: "Ghost ships of past crews haunt every chart.",
  },
  "golden-tide": {
    id: "golden-tide",
    name: "Golden Tide",
    glyph: "✦",
    tagline: "The sea glitters with promise.",
    effect: "The waters shimmer gold around the Vault.",
  },
  bloodstorm: {
    id: "bloodstorm",
    name: "Bloodstorm",
    glyph: "⚡",
    tagline: "A red sky at morning.",
    effect: "The sky burns crimson and the sea runs rough.",
  },
  "silent-waters": {
    id: "silent-waters",
    name: "Silent Waters",
    glyph: "◌",
    tagline: "Not a gull, not a whisper.",
    effect: "A hush falls: the narrator speaks softly and fog hangs heavy.",
  },
  "fair-winds": {
    id: "fair-winds",
    name: "Fair Winds",
    glyph: "⛵",
    tagline: "A good day to hunt.",
    effect: "Clear skies and steady seas.",
  },
};

/** Weighted so the rare conditions stay special. */
const ROTATION: SeaConditionId[] = [
  "fair-winds",
  "golden-tide",
  "fair-winds",
  "ghost-moon",
  "bloodstorm",
  "fair-winds",
  "silent-waters",
];

const DAY_MS = 86_400_000;

export function dayNumber(at: number | Date) {
  const ms = typeof at === "number" ? at : at.getTime();
  return Math.floor(ms / DAY_MS);
}

/** A small integer scramble so consecutive days don't simply walk the rotation in order. */
function scramble(n: number) {
  let x = (n ^ 0x5bd1e995) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

export function seaConditionFor(at: number | Date): SeaCondition {
  return SEA_CONDITIONS[ROTATION[scramble(dayNumber(at)) % ROTATION.length]];
}

/** Today and the next `days - 1` days, for the calendar view. */
export function seaForecast(at: number | Date, days = 7) {
  const start = dayNumber(at);
  return Array.from({ length: days }, (_, i) => ({
    day: start + i,
    date: new Date((start + i) * DAY_MS),
    condition: seaConditionFor((start + i) * DAY_MS),
  }));
}
