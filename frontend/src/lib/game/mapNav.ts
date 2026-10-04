/**
 * Arrow-key travel between islands on the chart. Picks the closest island that lies broadly in the
 * pressed direction, favouring ones straight ahead over ones off to the side.
 */

export type NavDirection = "up" | "down" | "left" | "right";

export interface NavPoint {
  key: string;
  x: number;
  y: number;
}

const AXIS: Record<NavDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const ARROW_DIRECTION: Record<string, NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Sideways drift counts this much more than distance ahead. */
const SIDEWAYS_COST = 2.5;

export function nearestInDirection(points: readonly NavPoint[], fromKey: string, direction: NavDirection): string | null {
  const from = points.find((p) => p.key === fromKey);
  if (!from) return points[0]?.key ?? null;
  const { dx, dy } = AXIS[direction];

  let best: { key: string; cost: number } | null = null;
  for (const p of points) {
    if (p.key === fromKey) continue;
    const vx = p.x - from.x;
    const vy = p.y - from.y;
    const ahead = vx * dx + vy * dy;
    if (ahead <= 0) continue;
    const sideways = Math.abs(vx * dy - vy * dx);
    // Within a 60° cone either side of the arrow.
    if (sideways > ahead * Math.tan((60 * Math.PI) / 180)) continue;
    const cost = ahead + sideways * SIDEWAYS_COST;
    if (!best || cost < best.cost) best = { key: p.key, cost };
  }
  return best?.key ?? null;
}

/** Home/End jump to the first and last island in voyage order. */
export function edgeIsland(points: readonly NavPoint[], edge: "first" | "last") {
  if (points.length === 0) return null;
  return edge === "first" ? points[0].key : points[points.length - 1].key;
}
