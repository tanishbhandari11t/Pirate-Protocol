/**
 * Map marks: pins, warnings and routes a sailor inks onto the shared chart. This is an add-on to the
 * main protocol, kept in its own module so it can be wired into contract.ts without touching game rules.
 *
 *   client → server  "map:mark"    { kind, points }  ack → MapMark
 *   client → server  "map:unmark"  { markId }        ack → null
 *   server → client  "map:marks"   { marks }         the room's full current set, after every change
 *
 * Marks are cosmetic and crew-visible only. The server owns ids, ownership, limits and expiry;
 * points use the same 0–100 grid as islands.
 */

export const MARK_KINDS = ["pin", "danger", "treasure", "route"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export interface MarkPoint {
  x: number;
  y: number;
}

export interface MapMark {
  id: string;
  playerId: string;
  kind: MarkKind;
  points: MarkPoint[];
  createdAt: number;
  expiresAt: number;
}

export interface PlaceMarkPayload {
  kind: MarkKind;
  points: MarkPoint[];
}

export interface RemoveMarkPayload {
  markId: string;
}

export interface MarksPush {
  marks: MapMark[];
}

export const MARK_LIMITS = {
  /** Live marks one sailor may have on the chart at once; the oldest fades when exceeded. */
  perSailor: 6,
  /** Points kept in a route after simplification. */
  routePoints: 24,
  /** Shortest route worth sending, in grid units. */
  minRouteLength: 4,
  ttlMs: 180_000,
  /** Requests per sailor per rolling minute. */
  perMinute: 24,
} as const;

export const MARK_LABEL: Record<MarkKind, string> = {
  pin: "Pin",
  danger: "Danger",
  treasure: "Treasure?",
  route: "Route",
};

/** Half a grid unit is finer than any finger can draw, and keeps payloads small. */
const quantize = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 2) / 2;

function isPoint(v: unknown): v is MarkPoint {
  if (!v || typeof v !== "object") return false;
  const { x, y } = v as Record<string, unknown>;
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y);
}

export function routeLength(points: readonly MarkPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Perpendicular distance from p to the segment a–b. */
function segmentDistance(p: MarkPoint, a: MarkPoint, b: MarkPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker: drops points that don't change the line's shape by more than `tolerance`. */
export function simplifyRoute(points: readonly MarkPoint[], tolerance = 0.8): MarkPoint[] {
  if (points.length <= 2) return [...points];
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = segmentDistance(points[i], points[0], points[points.length - 1]);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifyRoute(points.slice(0, at + 1), tolerance);
  const right = simplifyRoute(points.slice(at), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Simplifies harder until a route fits the point budget. */
export function fitRoute(points: readonly MarkPoint[], budget: number = MARK_LIMITS.routePoints): MarkPoint[] {
  let tolerance = 0.8;
  let out = simplifyRoute(points, tolerance);
  while (out.length > budget && tolerance < 50) {
    tolerance *= 1.6;
    out = simplifyRoute(points, tolerance);
  }
  return out.length > budget ? [out[0], out[out.length - 1]] : out;
}

/**
 * Validates a mark request the way the server must: known kind, finite points on the grid, a single
 * point for stamps, and a route long enough to mean something. Returns a cleaned copy or null.
 */
export function cleanMarkRequest(input: unknown): PlaceMarkPayload | null {
  if (!input || typeof input !== "object") return null;
  const { kind, points } = input as Record<string, unknown>;
  if (typeof kind !== "string" || !(MARK_KINDS as readonly string[]).includes(kind)) return null;
  if (!Array.isArray(points) || points.length === 0 || !points.every(isPoint)) return null;
  const cleaned = points.map((p) => ({ x: quantize(p.x), y: quantize(p.y) }));

  if (kind !== "route") return cleaned.length === 1 ? { kind: kind as MarkKind, points: cleaned } : null;
  if (cleaned.length < 2 || cleaned.length > MARK_LIMITS.routePoints) return null;
  if (routeLength(cleaned) < MARK_LIMITS.minRouteLength) return null;
  return { kind: "route", points: cleaned };
}

/** Marks still on the chart at `now`, oldest first. */
export function liveMarks(marks: readonly MapMark[], now: number) {
  return marks.filter((m) => m.expiresAt > now).sort((a, b) => a.createdAt - b.createdAt);
}

/** Adds a mark for its sailor, retiring that sailor's oldest marks beyond the per-sailor limit. */
export function addMark(marks: readonly MapMark[], mark: MapMark, now: number): MapMark[] {
  const live = liveMarks(marks, now);
  const mine = live.filter((m) => m.playerId === mark.playerId);
  const retire = new Set(mine.slice(0, Math.max(0, mine.length - MARK_LIMITS.perSailor + 1)).map((m) => m.id));
  return [...live.filter((m) => !retire.has(m.id)), mark];
}
