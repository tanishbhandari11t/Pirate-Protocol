"use client";

import { motion, useReducedMotionConfig } from "framer-motion";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FRAME_COLORS } from "@/lib/palettes";
import type { AvatarFrame as FrameId } from "@/lib/socket/contract";

interface AvatarFrameProps {
  frame: FrameId | null | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * A ring around a round portrait. The child fills the inner circle; the ring is drawn on top so it
 * can overlap the portrait's edge like a porthole bezel.
 */
export function AvatarFrame({ frame, children, className }: AvatarFrameProps) {
  if (!frame) return <div className={cn("relative overflow-hidden rounded-full", className)}>{children}</div>;
  return (
    <div className={cn("relative", className)}>
      <div className="absolute inset-[9%] overflow-hidden rounded-full">{children}</div>
      <FrameRing frame={frame} />
    </div>
  );
}

const RIVETS = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + offset;
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  });

function FrameRing({ frame }: { frame: FrameId }) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotionConfig();
  const c = FRAME_COLORS[frame];
  const metal = `${uid}-metal`;

  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.shine} />
          <stop offset="45%" stopColor={c.ring} />
          <stop offset="100%" stopColor={c.shadow} />
        </linearGradient>
      </defs>

      {frame === "rope" && (
        <g fill="none">
          <circle cx="50" cy="50" r="45.5" stroke={c.shadow} strokeWidth="7" />
          <circle cx="50" cy="50" r="45.5" stroke={c.ring} strokeWidth="5.5" />
          <circle cx="50" cy="50" r="45.5" stroke={c.shine} strokeWidth="5.5" strokeDasharray="2.2 3.2" opacity="0.7" />
          <circle cx="50" cy="50" r="45.5" stroke={c.shadow} strokeWidth="1" strokeDasharray="0.6 4.8" strokeDashoffset="2" />
        </g>
      )}

      {frame === "brass" && (
        <g>
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={`url(#${metal})`} strokeWidth="7" />
          <circle cx="50" cy="50" r="49" fill="none" stroke={c.shadow} strokeWidth="0.8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={c.shadow} strokeWidth="0.8" />
          {RIVETS(8, 45.5, Math.PI / 8).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.6" fill={c.shine} stroke={c.shadow} strokeWidth="0.5" />
          ))}
        </g>
      )}

      {frame === "silver" && (
        <g>
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={`url(#${metal})`} strokeWidth="7" />
          <circle cx="50" cy="50" r="45.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="30 260" />
          {[0, 90, 180, 270].map((deg) => (
            <path
              key={deg}
              d="M50 1.5 l3 3 -3 3 -3 -3 Z"
              transform={`rotate(${deg} 50 50)`}
              fill={c.shine}
              stroke={c.shadow}
              strokeWidth="0.5"
            />
          ))}
        </g>
      )}

      {frame === "gold" && (
        <g>
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={`url(#${metal})`} strokeWidth="8" />
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={c.shadow} strokeWidth="0.6" strokeDasharray="1 2.4" />
          {RIVETS(12, 45.5).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.3" fill={c.shine} />
          ))}
          <path d="M50 -3 l3 6 6.5 0.8 -4.8 4.4 1.3 6.4 -6 -3.2 -6 3.2 1.3 -6.4 -4.8 -4.4 6.5 -0.8 Z" fill={c.ring} stroke={c.shadow} strokeWidth="0.8" />
        </g>
      )}

      {frame === "legend" && (
        <g>
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={`url(#${metal})`} strokeWidth="8" />
          <Laurel side={-1} color="#4d8a63" vein="#1d5236" />
          <Laurel side={1} color="#4d8a63" vein="#1d5236" />
          <circle cx="50" cy="3" r="4.6" fill="#c2392f" stroke={c.ring} strokeWidth="1.6" />
          <circle cx="48.6" cy="1.8" r="1.2" fill="#fff" opacity="0.7" />
          {!reduced && (
            <motion.g
              style={{ transformOrigin: "50px 50px" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            >
              {[0, 120, 240].map((deg) => (
                <motion.path
                  key={deg}
                  d="M50 1 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z"
                  transform={`rotate(${deg} 50 50)`}
                  fill={c.shine}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: deg / 240 }}
                />
              ))}
            </motion.g>
          )}
        </g>
      )}
    </svg>
  );
}

function Laurel({ side, color, vein }: { side: 1 | -1; color: string; vein: string }) {
  const leaves = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 2 + side * (0.35 + i * 0.32);
    return { x: 50 + Math.cos(a) * 47, y: 50 + Math.sin(a) * 47, deg: (a * 180) / Math.PI + (side > 0 ? -60 : 60) };
  });
  return (
    <g>
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.deg})`}>
          <path d="M0 0 C2.5 -2.5 6.5 -2.5 9 0 C6.5 2.5 2.5 2.5 0 0 Z" fill={color} stroke={vein} strokeWidth="0.5" />
          <path d="M0.5 0 H8" stroke={vein} strokeWidth="0.4" />
        </g>
      ))}
    </g>
  );
}
