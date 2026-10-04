"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useVoyageClock } from "@/lib/crew/CrewProvider";
import { ClockIcon, HourglassIcon } from "../icons";

/**
 * Countdown on timed voyages, time at sea otherwise. The deadline comes from the server, so every
 * sailor's clock runs out at the same moment.
 */
export function VoyageClock({ className }: { className?: string }) {
  const clock = useVoyageClock();
  if (!clock.label) return null;

  const timed = clock.remainingMs !== null;
  const lowOnTime = timed && clock.remainingMs! < 5 * 60_000;

  return (
    <div className={cn("text-center", className)} aria-live={clock.urgent ? "assertive" : "off"}>
      <p className="font-ui text-[0.5rem] uppercase tracking-[0.25em] text-brass/60">{timed ? "Tide turns" : "Voyage"}</p>
      <motion.p
        className={cn(
          "mt-0.5 flex items-center justify-center gap-1 font-ui text-sm font-bold tabular-nums",
          clock.urgent ? "text-blood-light" : lowOnTime ? "text-ember" : "text-parchment",
        )}
        animate={clock.urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={clock.urgent ? { duration: 1, repeat: Infinity } : undefined}
        aria-label={timed ? `${clock.label} remaining` : `${clock.label} at sea`}
      >
        {timed ? <ClockIcon size={14} className="text-brass" /> : <HourglassIcon size={14} className="text-brass" />}
        {clock.label}
      </motion.p>
    </div>
  );
}
