import { seeded } from "./random";

/**
 * A jagged `clip-path` polygon for torn-paper edges. Offsets are in px so the tear looks the
 * same on any card size; it is static, so it costs nothing per frame (unlike an SVG filter).
 */
function buildTornEdge(seed: number, steps = 36, depth = 5) {
  const rand = seeded(seed);
  const jitter = () => (rand() * depth).toFixed(1);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(2)}% ${jitter()}px`);
  for (let i = 1; i <= steps; i++) pts.push(`calc(100% - ${jitter()}px) ${((i / steps) * 100).toFixed(2)}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(2)}% calc(100% - ${jitter()}px)`);
  for (let i = steps - 1; i >= 1; i--) pts.push(`${jitter()}px ${((i / steps) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(", ")})`;
}

export const TORN_EDGES = [buildTornEdge(11), buildTornEdge(23), buildTornEdge(37)] as const;
