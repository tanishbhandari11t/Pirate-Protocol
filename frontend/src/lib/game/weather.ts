import { chartPoint, CHART_H, CHART_W } from "./chart";
import { VAULT_KEY } from "./selectors";
import type { RoomState } from "../socket/contract";

/**
 * The sea reacts to the voyage: nothing here is random gameplay, only mood drawn from what the
 * server has already decided (the clock, traps sprung, the Vault opening, sailors lost).
 */
export type SeaState = "calm" | "breeze" | "squall" | "tempest";

export interface Weather {
  state: SeaState;
  /** Direction the wind blows towards, in degrees clockwise from north. */
  windDeg: number;
  /** 0 (glass-still) to 1 (screaming gale). */
  intensity: number;
  /** Rain and lightning over the chart. */
  storm: boolean;
  label: string;
  detail: string;
}

export interface WeatherInput {
  room: RoomState;
  /** Milliseconds left on a timed voyage; `null` when there is no clock. */
  remainingMs: number | null;
  /** True for a short while after any sailor springs a trap. */
  squall: boolean;
  vaultOpen: boolean;
}

/** The final stretch of a timed voyage where the sky turns. */
export const TEMPEST_MS = 60_000;
export const GATHERING_MS = 3 * 60_000;
/** How long a trap's squall lingers over the chart. */
export const SQUALL_MS = 12_000;

const COPY: Record<SeaState, { label: string; detail: string }> = {
  calm: { label: "Becalmed", detail: "Glass-still water. The fog keeps its secrets." },
  breeze: { label: "Fair winds", detail: "A steady wind fills the sails." },
  squall: { label: "Squall", detail: "Rain lashes the deck. Something stirred below." },
  tempest: { label: "Tempest", detail: "The tide turns. Every heartbeat counts." },
};

const INTENSITY: Record<SeaState, number> = { calm: 0.1, breeze: 0.4, squall: 0.75, tempest: 1 };

function hash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Bearing in degrees (clockwise from north) from one chart point towards another. */
function bearing(from: { x: number; y: number }, to: { x: number; y: number }) {
  return ((Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI + 360) % 360;
}

export function seaStateFor({ room, remainingMs, squall, vaultOpen }: WeatherInput): SeaState {
  if (room.status === "FINISHED") return "calm";
  if (remainingMs !== null && remainingMs <= TEMPEST_MS) return "tempest";
  if (squall || (remainingMs !== null && remainingMs <= GATHERING_MS)) return "squall";
  if (vaultOpen || room.players.some((p) => p.isEliminated)) return "breeze";
  return "calm";
}

export function weatherFor(input: WeatherInput, elapsedMs: number): Weather {
  const state = seaStateFor(input);
  const vault = input.room.islands.find((i) => i.key === VAULT_KEY);
  const centre = { x: CHART_W / 2, y: CHART_H / 2 };
  // Each ship has its own prevailing wind that veers a little every minute at sea.
  const drift = (hash(input.room.code) % 360) + Math.floor(elapsedMs / 60_000) * 23;
  const windDeg = input.vaultOpen && vault ? bearing(centre, chartPoint(vault)) : drift % 360;
  return {
    state,
    windDeg,
    intensity: INTENSITY[state],
    storm: state === "squall" || state === "tempest",
    ...COPY[state],
  };
}

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function compassPoint(deg: number) {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
