"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { bareShipName } from "@/lib/names";
import { CompassRose } from "../brand/CompassRose";

interface VoyageCountdownProps {
  startsAt: number;
  seconds: number;
  crewName: string;
}

/** Full-screen launch sequence shown between `game:starting` and `game:started`. */
export function VoyageCountdown({ startsAt, seconds, crewName }: VoyageCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [startsAt]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-abyss/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Voyage begins in ${remaining}`}
    >
      <motion.div
        aria-hidden
        className="absolute w-[min(90vmin,760px)] opacity-20"
        initial={{ rotate: 0, scale: 0.8 }}
        animate={{ rotate: 360, scale: 1.1 }}
        transition={{ duration: seconds + 1, ease: "easeInOut" }}
      >
        <CompassRose />
      </motion.div>

      <p className="relative px-6 text-center font-ui text-[0.65rem] uppercase tracking-[0.3em] text-brass-light/80 sm:text-xs sm:tracking-[0.5em]">
        The {bareShipName(crewName)} weighs anchor
      </p>

      <div className="relative mt-4 flex h-[clamp(8rem,32vmin,14rem)] items-center justify-center sm:mt-6">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={remaining}
            initial={{ scale: 2.2, opacity: 0, filter: "blur(16px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 0.4, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[clamp(6rem,30vmin,11rem)] leading-none text-gilded drop-shadow-[0_10px_40px_rgba(255,216,115,0.35)]"
          >
            {remaining > 0 ? remaining : "⚓"}
          </motion.span>
        </AnimatePresence>
      </div>

      <p className="relative mt-4 px-6 text-center font-body text-xl italic text-parchment/80 sm:text-2xl">
        {remaining > 0 ? "Man the sails. Trim the lanterns." : "Into the unknown…"}
      </p>
    </motion.div>
  );
}
