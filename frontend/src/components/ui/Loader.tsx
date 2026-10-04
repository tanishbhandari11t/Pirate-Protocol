"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CompassRose } from "../brand/CompassRose";

export function CompassSpinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <g style={{ transformOrigin: "12px 12px", animation: "spin 1.4s cubic-bezier(.6,.1,.4,.9) infinite" }}>
        <path d="M12 3.5 14 12h-4Z" fill="currentColor" />
        <path d="M12 20.5 10 12h4Z" fill="currentColor" opacity="0.4" />
      </g>
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

interface LoadingScreenProps {
  show: boolean;
  message?: string;
  detail?: string;
}

/** Full-screen cinematic loading veil. */
export function LoadingScreen({ show, message = "Charting the course", detail }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-abyss/85"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
        >
          <div className="relative h-40 w-40">
            <CompassRose className="absolute inset-0 animate-spin-slow opacity-70" />
            <motion.div
              className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(255,216,115,0.35),transparent_70%)]"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          </div>
          <p className="mt-8 font-display text-3xl text-gilded">{message}</p>
          {detail && <p className="mt-2 font-body italic text-parchment/70">{detail}</p>}
          <div className="mt-6 flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-brass"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} aria-hidden />;
}
