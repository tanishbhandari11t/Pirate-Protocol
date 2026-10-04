"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { playSfx, setMusic, setVolume, toggleMuted, useSoundSettings } from "@/lib/sound";
import { SoundIcon } from "../icons";

/** Header control: tap to open the ship's sound locker (mute, shanty, volume). */
export function SoundDeck({ className }: { className?: string }) {
  const { muted, volume, music } = useSoundSettings();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Sound settings"
        aria-expanded={open}
        aria-controls={panelId}
        title="Sound (M to mute)"
        className="rounded border border-brass/25 p-1.5 text-brass/80 transition hover:text-brass-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
      >
        <SoundIcon size={18} muted={muted} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Sound settings"
            className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-brass/40 bg-[linear-gradient(180deg,#0d1d2b,#060d14)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)]"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } }}
          >
            <p className="font-ui text-[0.55rem] uppercase tracking-[0.3em] text-brass/70">Ship&apos;s sound locker</p>

            <Toggle label="All sound" on={!muted} onChange={toggleMuted} />
            <Toggle label="Sea shanty" detail="Plays under the voyage" on={music} disabled={muted} onChange={() => setMusic(!music)} />

            <label className="mt-4 block">
              <span className="flex items-center justify-between font-ui text-[0.62rem] uppercase tracking-[0.2em] text-parchment/80">
                Volume <span className="tabular-nums text-brass-light">{muted ? "—" : `${Math.round(volume * 100)}%`}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                onPointerUp={() => playSfx("coin")}
                onKeyUp={() => playSfx("coin")}
                className="mt-2 w-full accent-[#d9b25a]"
              />
            </label>

            <p className="mt-3 font-body text-xs italic text-parchment/50">Every note is played live by your browser.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({
  label,
  detail,
  on,
  disabled = false,
  onChange,
}: {
  label: string;
  detail?: string;
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className="mt-3 flex w-full items-center justify-between gap-3 text-left disabled:opacity-40"
    >
      <span>
        <span className="block font-ui text-[0.62rem] uppercase tracking-[0.2em] text-parchment/80">{label}</span>
        {detail && <span className="block font-body text-xs italic text-parchment/50">{detail}</span>}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full border transition", on ? "border-gold/70 bg-gold/30" : "border-brass/30 bg-abyss")}>
        <motion.span
          className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full", on ? "bg-gold" : "bg-brass/50")}
          initial={false}
          animate={{ left: on ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </span>
    </button>
  );
}
