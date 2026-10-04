import { seeded } from "../random";

export const CHART_W = 1000;
export const CHART_H = 600;

/** Server islands live on a 0–100 grid; the chart keeps a margin for labels and the frame. */
export function chartPoint(island: { x: number; y: number }) {
  return { x: 70 + island.x * 8.6, y: 60 + island.y * 6.4 };
}

function hash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** An organic, hand-inked coastline unique to each island key. */
export function islandPath(key: string, radius: number) {
  const rand = seeded(hash(key));
  const points = 11;
  const pts = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const r = radius * (0.72 + rand() * 0.42);
    return [Math.cos(angle) * r * 1.25, Math.sin(angle) * r * 0.85] as const;
  });
  const mid = (a: readonly number[], b: readonly number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[points - 1], pts[0]);
  let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const next = mid(pts[i], pts[(i + 1) % points]);
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${next[0].toFixed(1)} ${next[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Gentle curved sea lane between two chart points. */
export function lanePath(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx - dy * bend).toFixed(1)} ${(my + dx * bend).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export const SAILOR_COLORS = ["#ffd873", "#7fd1c7", "#e8846f", "#b9a4f0", "#9fd39a", "#f0a9d0"];
