"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { LogEntry, LogTone } from "@/lib/crew/reducer";
import { AnchorIcon, CheckIcon, CrownIcon, DoorIcon, InfoIcon, ShipIcon } from "../icons";
import { Panel } from "../ui/Panel";

const TONE_ICON: Record<LogTone, { icon: ReactNode; color: string }> = {
  info: { icon: <InfoIcon size={13} />, color: "text-foam" },
  join: { icon: <AnchorIcon size={13} />, color: "text-kelp-light" },
  leave: { icon: <DoorIcon size={13} />, color: "text-ember" },
  ready: { icon: <CheckIcon size={13} />, color: "text-gold" },
  captain: { icon: <CrownIcon size={13} />, color: "text-brass-light" },
  voyage: { icon: <ShipIcon size={13} />, color: "text-blood-light" },
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function ShipsLog({ entries }: { entries: LogEntry[] }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <Panel eyebrow="Kept by the quartermaster" title="Ship's Log" padded={false}>
      <ol
        ref={listRef}
        className="max-h-60 space-y-2.5 overflow-y-auto px-5 py-4 sm:px-6 short:max-h-40 short:py-3"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            const tone = TONE_ICON[entry.tone];
            return (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3"
              >
                <span className={cn("mt-1 shrink-0", tone.color)}>{tone.icon}</span>
                <p className="flex-1 font-body leading-snug text-parchment/80">{entry.text}</p>
                <time className="mt-0.5 shrink-0 font-ui text-[0.6rem] tabular-nums text-brass/50">
                  {timeFormat.format(entry.at)}
                </time>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {entries.length === 0 && <li className="font-body italic text-parchment/40">The page is yet blank…</li>}
      </ol>
    </Panel>
  );
}
