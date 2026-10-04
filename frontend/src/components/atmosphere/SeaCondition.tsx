"use client";

import { motion, useReducedMotionConfig } from "framer-motion";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { seaConditionFor, type SeaCondition } from "@/lib/game/calendar";

const noop = () => () => {};

/** Today's condition. The server snapshot is null so nothing date-dependent renders before hydration. */
export function useSeaCondition(): SeaCondition | null {
  return useSyncExternalStore(
    noop,
    () => seaConditionFor(Date.now()),
    () => null,
  );
}

const TONE: Record<SeaCondition["id"], string> = {
  "ghost-moon": "border-[#9fe8e0]/50 text-[#cff7f2]",
  "golden-tide": "border-gold/60 text-gold",
  bloodstorm: "border-blood-light/70 text-[#ff9b8a]",
  "silent-waters": "border-foam/40 text-foam",
  "fair-winds": "border-brass/50 text-brass-light",
};

/** A small brass plaque naming today's world condition; links to the calendar in the Hall of Legends. */
export function SeaConditionBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const condition = useSeaCondition();
  if (!condition) return null;
  return (
    <Link
      href="/legends#calendar"
      title={`${condition.name}: ${condition.effect}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-abyss/70 px-3 py-1 font-ui text-[0.6rem] uppercase tracking-[0.2em] backdrop-blur-sm transition hover:bg-abyss/90",
        TONE[condition.id],
        className,
      )}
    >
      <span aria-hidden className="text-sm">
        {condition.glyph}
      </span>
      <span>{condition.name}</span>
      {!compact && <span className="hidden normal-case tracking-normal italic opacity-80 sm:inline">· {condition.tagline}</span>}
    </Link>
  );
}

/** Full-screen colour wash for the conditions that change the sky. Decorative only. */
export function SeaConditionWash({ condition }: { condition: SeaCondition | null }) {
  const still = useReducedMotionConfig();
  if (!condition || (condition.id !== "bloodstorm" && condition.id !== "golden-tide" && condition.id !== "ghost-moon")) return null;
  const tint =
    condition.id === "bloodstorm"
      ? "radial-gradient(ellipse at 50% 0%, rgba(160,20,10,0.35), transparent 65%)"
      : condition.id === "golden-tide"
        ? "radial-gradient(ellipse at 50% 100%, rgba(255,205,90,0.18), transparent 60%)"
        : "radial-gradient(ellipse at 80% 10%, rgba(140,240,225,0.16), transparent 55%)";
  return (
    <motion.div
      data-decor
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 mix-blend-screen"
      style={{ background: tint }}
      animate={still ? undefined : { opacity: [0.6, 1, 0.6] }}
      transition={{ duration: condition.id === "bloodstorm" ? 4 : 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
