"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotionConfig, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { playSfx } from "@/lib/sound";

interface Delta {
  id: number;
  value: number;
}

interface Track {
  prev: number;
  seq: number;
  deltas: Delta[];
}

/** Rolls the server's score up or down and floats the change above it. */
export function ScoreTicker({ score, className }: { score: number; className?: string }) {
  const still = useReducedMotionConfig();
  const value = useMotionValue(score);
  const text = useTransform(value, (v) => Math.round(v).toLocaleString());
  const [track, setTrack] = useState<Track>({ prev: score, seq: 0, deltas: [] });

  if (track.prev !== score) {
    const seq = track.seq + 1;
    setTrack({ prev: score, seq, deltas: [...track.deltas, { id: seq, value: score - track.prev }].slice(-3) });
  }

  useEffect(() => {
    if (still) {
      value.set(score);
      return;
    }
    const controls = animate(value, score, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [score, still, value]);

  const latest = track.deltas.at(-1);
  useEffect(() => {
    if (latest && latest.value > 0) playSfx("coin");
  }, [latest]);

  const dismiss = (id: number) => setTrack((t) => ({ ...t, deltas: t.deltas.filter((d) => d.id !== id) }));

  return (
    <span className={cn("relative inline-flex", className)}>
      <motion.span
        key={track.seq}
        className={cn("tabular-nums", score < 0 ? "text-blood-light" : "text-gold")}
        initial={false}
        animate={track.seq && !still ? { scale: [1, 1.3, 1] } : undefined}
        transition={{ duration: 0.45 }}
      >
        {text}
      </motion.span>
      <AnimatePresence>
        {track.deltas.map((d) => (
          <motion.span
            key={d.id}
            className={cn(
              "pointer-events-none absolute left-1/2 top-0 whitespace-nowrap font-ui text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
              d.value > 0 ? "text-gold" : "text-blood-light",
            )}
            initial={{ opacity: 0, x: "-50%", y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -26 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            onAnimationComplete={() => dismiss(d.id)}
          >
            {d.value > 0 ? `+${d.value}` : d.value}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
