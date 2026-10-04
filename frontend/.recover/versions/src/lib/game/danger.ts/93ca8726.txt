import type { PlayerId, RoomState } from "../socket/contract";
import { chartPoint } from "./chart";
import { mixColor } from "./sky";
import { findPlayer, islandByKey, solvedKeys } from "./selectors";
import type { SeaState } from "./weather";

/**
 * How menacing the water around this sailor looks. Built only from what the screen already shows:
 * charted trap islands, the kraken sighting, the sea state and the sailor's own strikes.
 */

/** Chart distance within which a charted trap island darkens the water. */
export const TRAP_REACH = 190;

export interface DangerInput {
  room: RoomState;
  meId: PlayerId;
  charted: ReadonlySet<string>;
  sea: SeaState;
  /** A kraken is surfacing somewhere on the chart. */
  kraken: boolean;
}

export type DangerReason = "anchored-at-trap" | "trap-nearby" | "kraken" | "tempest" | "squall" | "wounded";

export interface Danger {
  /** 0 (safe waters) to 1 (deadly). */
  level: number;
  reasons: DangerReason[];
  /** Ocean tint for the backdrop at this level. */
  tint: string;
}

export interface TrapZone {
  key: string;
  x: number;
  y: number;
  /** The sailor has already beaten this island's riddle, so its menace is spent. */
  spent: boolean;
}

const SAFE = "#1f5566";
const DEADLY = "#4a1820";

/** Charted trap islands, with chart coordinates, for drawing danger water on the map. */
export function trapZones(room: RoomState, charted: ReadonlySet<string>, meId: PlayerId): TrapZone[] {
  const solved = solvedKeys(room, meId);
  return room.islands
    .filter((i) => i.kind === "TRAP" && charted.has(i.key))
    .map((i) => ({ key: i.key, ...chartPoint(i), spent: i.puzzles.length > 0 && i.puzzles.every((p) => solved.has(p.key)) }));
}

export function dangerFor({ room, meId, charted, sea, kraken }: DangerInput): Danger {
  const me = findPlayer(room, meId);
  const reasons: DangerReason[] = [];
  let level = 0;

  if (me && !me.isEliminated) {
    const here = islandByKey(room, me.currentIslandKey);
    const zones = trapZones(room, charted, meId).filter((z) => !z.spent);
    if (here && zones.some((z) => z.key === here.key)) {
      level += 0.4;
      reasons.push("anchored-at-trap");
    } else if (here) {
      const p = chartPoint(here);
      const near = zones.filter((z) => Math.hypot(z.x - p.x, z.y - p.y) <= TRAP_REACH).length;
      if (near > 0) {
        level += Math.min(0.3, near * 0.15);
        reasons.push("trap-nearby");
      }
    }
    const maxStrikes = room.settings.maxStrikes;
    if (me.strikes > 0 && maxStrikes > 0) {
      level += (me.strikes / maxStrikes) * 0.25;
      reasons.push("wounded");
    }
  }

  if (kraken) {
    level += 0.3;
    reasons.push("kraken");
  }
  if (sea === "tempest") {
    level += 0.25;
    reasons.push("tempest");
  } else if (sea === "squall") {
    level += 0.1;
    reasons.push("squall");
  }

  const clamped = Math.min(1, level);
  return { level: clamped, reasons, tint: mixColor(SAFE, DEADLY, clamped) };
}
