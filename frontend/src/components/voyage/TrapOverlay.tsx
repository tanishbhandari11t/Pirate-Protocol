"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { MAX_STRIKES as DEFAULT_MAX_STRIKES } from "@/lib/socket/contract";
import { playSfx, vibrate } from "@/lib/sound";
import { shake } from "../fx/ScreenShake";
import { SkullIcon } from "../icons";
import { tentaclePath } from "./SeaLife";

const RISING = [
  { left: "4%", length: 260, width: 26, curl: 1.3, sway: -0.2, delay: 0 },
  { left: "18%", length: 200, width: 20, curl: -1.1, sway: 0.3, delay: 0.12 },
  { left: "78%", length: 230, width: 24, curl: 1.2, sway: -0.3, delay: 0.06 },
  { left: "92%", length: 280, width: 28, curl: -1.4, sway: 0.2, delay: 0.18 },
];

interface TrapOverlayProps {
  strikes: number;
  eliminated: boolean;
  islandName: string;
  maxStrikes?: number;
  onDone: () => void;
}

export function TrapOverlay({ strikes, eliminated, islandName, maxStrikes = DEFAULT_MAX_STRIKES, onDone }: TrapOverlayProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  useEffect(() => {
    playSfx("trap");
    shake(eliminated ? 2.6 : 1.6);
    vibrate(eliminated ? [120, 60, 120, 60, 400] : [80, 60, 160]);
    const timer = window.setTimeout(() => onDoneRef.current(), eliminated ? 5200 : 3600);
    return () => window.clearTimeout(timer);
  }, [eliminated]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(92,18,14,0.55),rgba(3,7,12,0.94)_70%)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      onClick={onDone}
      role="alertdialog"
      aria-live="assertive"
      aria-label={eliminated ? "The sea has claimed you" : `You have been struck, ${strikes} of ${maxStrikes}`}
    >
      {RISING.map((t) => (
        <motion.svg
          key={t.left}
          aria-hidden
          className="pointer-events-none absolute bottom-0 -translate-x-1/2 overflow-visible"
          style={{ left: t.left }}
          width={t.width * 4}
          height={t.length}
          viewBox={`${-t.width * 2} ${-t.length} ${t.width * 4} ${t.length}`}
          initial={{ y: t.length, opacity: 0 }}
          animate={{ y: t.length * 0.15, opacity: 0.9 }}
          transition={{ type: "spring", stiffness: 90, damping: 12, delay: t.delay }}
        >
          <motion.path
            fill="#1c2e2b"
            stroke="#0d1716"
            strokeWidth="2"
            d={tentaclePath(t.length, t.width, t.curl, t.sway)}
            initial={{ d: tentaclePath(t.length, t.width, t.curl, t.sway) }}
            animate={{
              d: [
                tentaclePath(t.length, t.width, t.curl, t.sway),
                tentaclePath(t.length, t.width, t.curl * 1.4, -t.sway),
                tentaclePath(t.length, t.width, t.curl, t.sway),
              ],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: t.delay }}
          />
        </motion.svg>
      ))}
      <motion.div
        className="relative text-center"
        initial={{ scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, x: [0, -12, 10, -6, 4, 0] }}
        transition={{ duration: 0.6 }}
      >
        <p className="font-ui text-xs uppercase tracking-[0.45em] text-[#f2a097]">A trap at {islandName}</p>
        <h2 className="mt-3 font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-none text-[#ffd9cf]">
          {eliminated ? "The Sea Claims You" : "You Have Been Struck"}
        </h2>
        <div className="mt-6 flex justify-center gap-4" aria-hidden>
          {Array.from({ length: maxStrikes }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-2",
                i < strikes ? "border-blood-light bg-blood/50 text-[#ffd9cf]" : "border-parchment/20 text-parchment/20",
              )}
            >
              <SkullIcon size={26} />
            </span>
          ))}
        </div>
        <p className="mt-4 font-display text-4xl text-[#f2a097]">
          {strikes} / {maxStrikes}
        </p>
        <p className="mx-auto mt-4 max-w-md font-body text-lg italic text-parchment/80">
          {eliminated
            ? `${maxStrikes === 1 ? "One strike" : `${maxStrikes} strikes`}. Your ship drifts on as a ghost — watch over your crew.`
            : "A cursed coin finds its way into your pocket. The fog thickens around you."}
        </p>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
