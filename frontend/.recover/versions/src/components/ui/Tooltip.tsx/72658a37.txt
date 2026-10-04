"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/** Small ink-on-parchment label, shown on hover and keyboard focus. */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === "top" ? 6 : -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            className={cn(
              "pointer-events-none absolute left-1/2 z-40 w-max max-w-64 -translate-x-1/2",
              side === "top" ? "bottom-full mb-2.5" : "top-full mt-2.5",
            )}
          >
            <span className="parchment block rounded-[3px] px-3 py-1.5 text-center font-body text-sm leading-snug text-ink">
              {content}
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-parchment",
                side === "top" ? "-bottom-1" : "-top-1",
              )}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
