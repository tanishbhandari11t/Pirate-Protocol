"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface LetterboxProps {
  children: ReactNode;
  /** Bar height as a share of the viewport. */
  bars?: string;
  onSkip?: () => void;
  skipLabel?: string;
  className?: string;
  label: string;
}

/** Full-screen stage with cinema bars that slide in, and an optional skip control. */
export function Letterbox({ children, bars = "11vh", onSkip, skipLabel = "Skip", className, label }: LetterboxProps) {
  return (
    <motion.div
      className={cn("fixed inset-0 z-[70] overflow-hidden bg-abyss", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7 } }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 z-20 bg-black"
        initial={{ height: 0 }}
        animate={{ height: bars }}
        exit={{ height: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-20 bg-black"
        initial={{ height: 0 }}
        animate={{ height: bars }}
        exit={{ height: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="absolute bottom-[3vh] right-5 z-30 rounded border border-brass/40 px-3 py-1 font-ui text-[0.6rem] uppercase tracking-[0.3em] text-brass-light/80 transition hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
        >
          {skipLabel} <span className="text-brass/50">(Esc)</span>
        </button>
      )}
    </motion.div>
  );
}
