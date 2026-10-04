"use client";

import { motion } from "framer-motion";
import { chartPoint } from "@/lib/game/chart";

export interface GhostRoute {
  id: string;
  /** Shown on hover, e.g. "The ghost of Anne, The Black Gull". */
  label: string;
  /** Recorded positions on the 0–100 grid, in the order they were sailed. */
  points: { x: number; y: number }[];
}

const LEG_SECONDS = 2.6;

/**
 * Spectral echoes of earlier crews: each ghost retraces a route that was really sailed in a past
 * voyage. Purely atmospheric; ghosts can't be selected and never block the chart.
 */
export function GhostFleet({ ghosts, still }: { ghosts: GhostRoute[]; still: boolean }) {
  return (
    <g aria-hidden style={{ pointerEvents: "none" }}>
      {ghosts.map((ghost, gi) => {
        const pts = ghost.points.map(chartPoint);
        if (pts.length < 2) return null;
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        const duration = (pts.length - 1) * LEG_SECONDS;
        return (
          <g key={ghost.id} opacity={0.55}>
            <title>{ghost.label}</title>
            <path d={d} fill="none" stroke="#9fe8e0" strokeWidth={1.4} strokeDasharray="2 7" strokeLinecap="round" opacity={0.45} />
            <motion.g
              initial={{ x: pts[0].x, y: pts[0].y }}
              animate={still ? { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y } : { x: pts.map((p) => p.x), y: pts.map((p) => p.y) }}
              transition={still ? { duration: 0 } : { duration, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 + gi, delay: gi * 1.7 }}
            >
              <motion.g
                animate={still ? undefined : { opacity: [0.35, 0.9, 0.35], y: [0, -2, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{ filter: "drop-shadow(0 0 6px rgba(159,232,224,0.9))" }}
              >
                <path d="M-11 2 Q0 9 11 2 L8 6 Q0 10 -8 6 Z" fill="#cfF7f2" fillOpacity={0.55} stroke="#9fe8e0" strokeWidth={0.8} />
                <path d="M0 2 V-16" stroke="#9fe8e0" strokeWidth={1} />
                <path d="M0 -15 Q8 -9 1 -3 Z" fill="#cff7f2" fillOpacity={0.4} stroke="#9fe8e0" strokeWidth={0.6} />
                <path d="M0 -14 Q-7 -9 -1 -4 Z" fill="#cff7f2" fillOpacity={0.3} stroke="#9fe8e0" strokeWidth={0.6} />
              </motion.g>
            </motion.g>
          </g>
        );
      })}
    </g>
  );
}
