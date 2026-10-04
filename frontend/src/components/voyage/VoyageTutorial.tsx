"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";

const DONE_KEY = "pp:tutorial-done";
const CARD_W = 320;
const CARD_H = 210;
const PAD = 8;

const STEPS = [
  {
    target: "map",
    title: "The Living Map",
    text: "Tap an island to inspect it, then set sail. Fog hides every shore your crew has not charted yet.",
  },
  {
    target: "hud",
    title: "Your Instruments",
    text: "Relics, strikes and plunder live up here. Three strikes and the sea claims you.",
  },
  {
    target: "tabs",
    title: "Crew, Hold & Log",
    text: "Watch your crewmates, pass cursed trinkets from your hold, and follow every deed in the Captain's Log.",
  },
  {
    target: "map",
    title: "The Lost Vault",
    text: "Carry all five relics and the fog in the north will part. Press ? any time for keyboard shortcuts.",
  },
];

export function tutorialSeen() {
  return typeof window === "undefined" || localStorage.getItem(DONE_KEY) === "1";
}

/** The visible copy of a `data-tour` anchor; desktop and mobile layouts may each render one. */
function findTarget(name: string) {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  return Array.from(all).find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

export function VoyageTutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const onDoneRef = useRef(onDone);
  const current = STEPS[step];

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const measure = () => setRect(findTarget(current.target)?.getBoundingClientRect() ?? null);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [current.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        localStorage.setItem(DONE_KEY, "1");
        onDoneRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const finish = () => {
    localStorage.setItem(DONE_KEY, "1");
    onDone();
  };
  const last = step === STEPS.length - 1;

  const card = (() => {
    const w = Math.min(CARD_W, window.innerWidth - 32);
    if (!rect) return { top: window.innerHeight / 2 - CARD_H / 2, left: (window.innerWidth - w) / 2, width: w };
    const below = rect.bottom + PAD + 12;
    const top = below + CARD_H < window.innerHeight ? below : Math.max(16, rect.top - PAD - 12 - CARD_H);
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - w - 16);
    return { top, left, width: w };
  })();

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="How to play">
      <motion.div
        aria-hidden
        className="pointer-events-none fixed rounded-md border-2 border-gold shadow-[0_0_0_9999px_rgba(3,7,12,0.74)]"
        initial={false}
        animate={
          rect
            ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
            : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 }
        }
        transition={{ type: "spring", stiffness: 220, damping: 30 }}
      />
      <motion.div
        key={step}
        className="wood-panel fixed rounded-md p-5"
        style={card}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-ui text-[0.58rem] uppercase tracking-[0.35em] text-brass/80">
          First voyage · {step + 1}/{STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-3xl leading-none text-gilded">{current.title}</h2>
        <p className="mt-2 font-body text-base leading-snug text-parchment/85">{current.text}</p>
        <div className="mt-4 flex justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <Button size="sm" onClick={() => (last ? finish() : setStep(step + 1))} autoFocus>
            {last ? "Weigh anchor" : "Next"}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
