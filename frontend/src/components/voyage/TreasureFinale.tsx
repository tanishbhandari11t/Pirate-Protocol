"use client";

import { motion, useReducedMotionConfig } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHART_H, CHART_W, chartPoint, islandPath, lanePath } from "@/lib/game/chart";
import { VAULT_KEY } from "@/lib/game/selectors";
import type { RoomState } from "@/lib/socket/contract";
import { playSfx, vibrate } from "@/lib/sound";
import { CompassRose } from "../brand/CompassRose";
import { Button } from "../ui/Button";

/** Beat timings (ms): darken, compass, route, camera, chest, open, gold, title, results. */
const BEATS = [0, 700, 1700, 2900, 4000, 5000, 5400, 6100, 9400];
const CHEST_BEAT = 4;
const EASE = [0.22, 1, 0.36, 1] as const;
const FULL_VIEW = `0 0 ${CHART_W} ${CHART_H}`;
const ZOOM = 2.6;

function zoomView(focus: { x: number; y: number }) {
  const w = CHART_W / ZOOM;
  const h = CHART_H / ZOOM;
  const x = Math.min(Math.max(focus.x - w / 2, 0), CHART_W - w);
  const y = Math.min(Math.max(focus.y - h / 2, 0), CHART_H - h);
  return `${x} ${y} ${w} ${h}`;
}

interface TreasureFinaleProps {
  room: RoomState;
  winnerName: string | null;
  onDone: () => void;
}

export function TreasureFinale({ room, winnerName, onDone }: TreasureFinaleProps) {
  const reduced = useReducedMotionConfig();
  const [step, setStep] = useState(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const chest = window.setTimeout(() => {
      playSfx("treasure");
      vibrate([60, 40, 60, 40, 240]);
    }, reduced ? 50 : BEATS[CHEST_BEAT]);
    if (reduced) {
      const t = window.setTimeout(() => setStep(BEATS.length - 2), 50);
      return () => [t, chest].forEach((id) => window.clearTimeout(id));
    }
    const timers = BEATS.map((at, i) =>
      window.setTimeout(() => (i === BEATS.length - 1 ? onDoneRef.current() : setStep(i)), at),
    );
    return () => [...timers, chest].forEach((id) => window.clearTimeout(id));
  }, [reduced]);

  const vault = room.islands.find((i) => i.key === VAULT_KEY);
  const start = room.islands.find((i) => i.order === 0) ?? room.islands[0];
  const vp = chartPoint(vault ?? { x: 90, y: 14 });
  const sp = chartPoint(start ?? { x: 12, y: 70 });

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden bg-abyss"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      role="dialog"
      aria-modal="true"
      aria-label="Treasure discovered"
    >
      <motion.svg
        viewBox={FULL_VIEW}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: step >= 4 ? 0.25 : 0.55, viewBox: step >= 3 ? zoomView(vp) : FULL_VIEW }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        <rect width={CHART_W} height={CHART_H} fill="#c9a86b" />
        {room.islands.map((island) => {
          const p = chartPoint(island);
          return (
            <path
              key={island.key}
              d={islandPath(island.key, 26)}
              transform={`translate(${p.x} ${p.y})`}
              fill={island.key === VAULT_KEY ? "#ffd873" : "#d8bd84"}
              stroke="#57391d"
              strokeWidth={2}
            />
          );
        })}
        <motion.path
          d={lanePath(sp, vp, 0.3)}
          fill="none"
          stroke="#ffd873"
          strokeWidth={5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: step >= 2 ? 1 : 0 }}
          transition={{ duration: 1.1 }}
        />
      </motion.svg>

      <motion.div
        className="absolute left-4 top-4 w-24 sm:left-8 sm:top-8 sm:w-32"
        initial={{ opacity: 0, rotate: -200 }}
        animate={step >= 1 ? { opacity: 1, rotate: 45 } : { opacity: 0, rotate: -200 }}
        transition={{ duration: 1.2, ease: EASE }}
        aria-hidden
      >
        <CompassRose />
      </motion.div>

      <div className="relative flex h-full flex-col items-center justify-center p-4 text-center">
        <motion.div
          className={`relative flex h-40 w-40 items-center justify-center rounded-full ${step >= 6 ? "shadow-[0_0_120px_40px_rgba(255,216,115,0.5)]" : ""}`}
          initial={{ opacity: 0, y: 60 }}
          animate={step >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.9, ease: EASE }}
          aria-hidden
        >
          <svg viewBox="0 0 220 180" className="h-full w-full">
            <rect x="30" y="90" width="160" height="78" rx="6" fill="#5b3418" stroke="#2b1b0d" strokeWidth="4" />
            <rect x="98" y="104" width="24" height="30" rx="3" fill="#f1d68d" />
            {step >= 5 && <ellipse cx="110" cy="92" rx="74" ry="12" fill="#ffd873" />}
            <motion.path
              d="M30 92 Q30 48 110 48 Q190 48 190 92 Z"
              fill="#6e3f1d"
              stroke="#2b1b0d"
              strokeWidth="4"
              animate={{ y: step >= 5 ? -40 : 0, opacity: step >= 5 ? 0.6 : 1 }}
            />
          </svg>
        </motion.div>

        {step >= 7 && (
          <motion.div initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE }}>
            <p className="mt-6 font-ui text-xs uppercase tracking-[0.45em] text-brass-light">The lost vault has been opened</p>
            <h2 className="mt-2 font-display text-[clamp(3rem,11vw,6rem)] leading-none text-gilded">Treasure Discovered</h2>
            {winnerName && <p className="mt-3 font-body text-xl italic text-parchment/85">{winnerName} turned the final key.</p>}
            <Button size="lg" className="mt-6" onClick={onDone}>
              Count the plunder
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
