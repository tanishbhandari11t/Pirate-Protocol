"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { a11yStore, TEXT_SCALES, useA11y, type TextScale } from "@/lib/a11y";

const TEXT_LABEL: Record<TextScale, string> = { 1: "Standard", 1.15: "Large", 1.3: "Larger" };

/** A small, always-reachable ship's wheel that opens the accessibility settings. */
export function AccessibilityMenu() {
  const settings = useA11y();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="fixed bottom-4 left-4 z-[65]">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Accessibility settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full border border-brass/50 bg-abyss/85 text-brass-light shadow-[0_6px_18px_rgba(0,0,0,0.6)] backdrop-blur transition hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/80"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="12" y1="1.5" x2="12" y2="5.5" transform={`rotate(${deg} 12 12)`} strokeLinecap="round" />
          ))}
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Accessibility settings"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-12 left-0 w-[min(88vw,19rem)] rounded-md border border-brass/40 bg-abyss/95 p-4 text-parchment shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur"
          >
            <p className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.35em] text-brass-light/80">Ship&apos;s comforts</p>

            <Row label="High contrast" hint="Brighter text, solid parchment, bold focus rings.">
              <Switch on={settings.contrast === "high"} label="High contrast" onChange={(on) => a11yStore.set({ contrast: on ? "high" : "normal" })} />
            </Row>
            <Row label="Reduce motion" hint="Cuts cinematics, camera moves and drifting scenery.">
              <Switch on={settings.motion === "reduce"} label="Reduce motion" onChange={(on) => a11yStore.set({ motion: on ? "reduce" : "system" })} />
            </Row>
            <Row label="Calm effects" hint="No lightning flashes or screen shake.">
              <Switch on={settings.calmEffects} label="Calm effects" onChange={(on) => a11yStore.set({ calmEffects: on })} />
            </Row>

            <fieldset className="mt-4">
              <legend className="font-display text-base leading-none">Text size</legend>
              <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Text size">
                {TEXT_SCALES.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    role="radio"
                    aria-checked={settings.textScale === scale}
                    onClick={() => a11yStore.set({ textScale: scale })}
                    className={cn(
                      "rounded border px-2 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.15em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/80",
                      settings.textScale === scale ? "border-gold bg-brass/20 text-gold" : "border-brass/30 text-parchment/70 hover:border-brass/60",
                    )}
                  >
                    {TEXT_LABEL[scale]}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => a11yStore.reset()}
              className="mt-4 font-ui text-[0.6rem] uppercase tracking-[0.25em] text-brass/70 underline-offset-4 hover:text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/80"
            >
              Restore defaults
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-3">
      <div>
        <p className="font-display text-base leading-none">{label}</p>
        <p className="mt-1 font-body text-sm italic leading-snug text-parchment/65">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/80",
        on ? "border-gold bg-brass/60" : "border-brass/40 bg-deep",
      )}
    >
      <span className={cn("absolute top-0.5 h-4.5 w-4.5 rounded-full bg-parchment shadow transition-[left]", on ? "left-[1.35rem]" : "left-0.5")} />
    </button>
  );
}
