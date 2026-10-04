"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { destinationLabel, leagues, type Destination } from "@/lib/game/heading";
import { playSfx } from "@/lib/sound";
import { CompassDial } from "../voyage/HelmCompass";

interface CompassRevealProps {
  destination: Destination | null;
  /** Spins before the needle settles. */
  spins?: number;
  /** Called once the reading has been on screen long enough to read; omit to stay until dismissed. */
  onDone?: () => void;
  holdMs?: number;
  className?: string;
}

/**
 * A compass that spins up, then settles on the bearing to the next destination. Uncharted islands
 * are only given as a direction, so the reveal never names a shore the crew has not seen.
 */
export function CompassReveal({ destination, spins = 3, onDone, holdMs = 3_400, className }: CompassRevealProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const chime = window.setTimeout(() => playSfx("coin"), 1_300);
    const done = onDoneRef.current ? window.setTimeout(() => onDoneRef.current?.(), holdMs) : null;
    return () => {
      window.clearTimeout(chime);
      if (done) window.clearTimeout(done);
    };
  }, [holdMs]);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      role="status"
      aria-label={destination ? `Next heading: ${destinationLabel(destination)}` : "The compass finds no heading"}
    >
      <div className="relative mx-auto w-[min(48vw,13rem)]">
        <motion.div
          aria-hidden
          className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(255,216,115,0.35),transparent_65%)]"
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <CompassDial bearing={destination?.bearing ?? null} spins={spins} settle={2.2} className="relative w-full drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)]" />
      </div>
      <motion.div className="mt-4 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.6 }}>
        <p className="font-ui text-[0.6rem] uppercase tracking-[0.4em] text-brass-light/80">
          {destination?.reason === "vault" ? "The Vault calls" : "The needle settles"}
        </p>
        <p className="mt-1 font-display text-[clamp(1.6rem,4vw,2.4rem)] leading-none text-gilded">
          {destination ? destinationLabel(destination) : "No heading"}
        </p>
        {destination && destination.distance >= 1 && (
          <p className="mt-1 font-body text-base italic text-parchment/70">{leagues(destination.distance)} leagues off the bow</p>
        )}
      </motion.div>
    </motion.div>
  );
}
