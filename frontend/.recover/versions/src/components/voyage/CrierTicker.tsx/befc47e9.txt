"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { LogEntry, LogTone } from "@/lib/crew/reducer";
import { BinocularsIcon, ChestIcon, ClockIcon, CoinIcon, CompassIcon, KeyIcon, LightbulbIcon, MegaphoneIcon, SkullIcon, WarningIcon } from "../icons";

/** Log tones worth shouting across the deck mid-voyage. */
const SHOUTED: Partial<Record<LogTone, { icon: ReactNode; className: string }>> = {
  discover: { icon: <CompassIcon size={16} />, className: "border-kelp text-kelp" },
  solve: { icon: <KeyIcon size={16} />, className: "border-brass-dark text-brass-dark" },
  item: { icon: <CoinIcon size={16} />, className: "border-brass-dark text-brass-dark" },
  trap: { icon: <SkullIcon size={16} />, className: "border-blood text-blood" },
  fail: { icon: <WarningIcon size={16} />, className: "border-ember text-ember" },
  trade: { icon: <CoinIcon size={16} />, className: "border-ink-soft text-ink-soft" },
  hint: { icon: <LightbulbIcon size={16} />, className: "border-brass-dark text-brass-dark" },
  watch: { icon: <BinocularsIcon size={16} />, className: "border-ink-soft text-ink-soft" },
  clock: { icon: <ClockIcon size={16} />, className: "border-blood text-blood" },
  treasure: { icon: <ChestIcon size={16} />, className: "border-gold text-brass-dark" },
};

const SHOW_MS = 5_500;

/** A ribbon unfurled over the chart each time the ship's log records something worth shouting about. */
export function CrierTicker({ entries, className }: { entries: LogEntry[]; className?: string }) {
  const latest = entries.findLast((e) => e.tone in SHOUTED) ?? null;
  const [dismissedId, setDismissedId] = useState<number | null>(() => latest?.id ?? null);

  useEffect(() => {
    if (!latest || latest.id === dismissedId) return;
    const timer = window.setTimeout(() => setDismissedId(latest.id), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [latest, dismissedId]);

  const shown = latest && latest.id !== dismissedId ? latest : null;
  const style = shown ? SHOUTED[shown.tone] : null;

  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-6", className)} aria-live="polite">
      <AnimatePresence mode="wait">
        {shown && style && (
          <motion.div
            key={shown.id}
            className={cn(
              "pointer-events-auto relative flex max-w-[min(36rem,100%)] items-center gap-2.5 border-y-2 bg-[linear-gradient(180deg,#f3e3bb,#e2c98f)] px-5 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.45)]",
              style.className,
            )}
            style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%)" }}
            initial={{ opacity: 0, scaleX: 0.2, y: -12 }}
            animate={{ opacity: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, scaleX: 0.6, y: -10, transition: { duration: 0.3 } }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={() => setDismissedId(shown.id)}
            role="status"
          >
            <MegaphoneIcon size={14} className="shrink-0 text-ink/60" />
            <span className="shrink-0">{style.icon}</span>
            <span className="truncate font-body text-base italic text-ink">{shown.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
