"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { CloseIcon } from "../icons";
import { InkFlourish } from "./ParchmentCard";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Prevent closing by backdrop click / Escape, e.g. during a pending request. */
  dismissible?: boolean;
}

const WIDTHS = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

const noopSubscribe = () => () => {};

/** A parchment scroll that unrolls over a fogged backdrop. */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "md",
  dismissible = true,
}: ModalProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], button, [href], input, select, textarea",
      );
      target?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onCloseRef.current();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissible]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-abyss/80"
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn("relative w-full", WIDTHS[size])}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <ScrollRod />
            <motion.div
              className="relative origin-top overflow-hidden"
              initial={{ clipPath: "inset(0 0 100% 0)" }}
              animate={{ clipPath: "inset(0 0 0% 0)" }}
              exit={{ clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="parchment relative mx-3 max-h-[calc(100dvh-5rem)] overflow-y-auto px-5 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft transition hover:bg-ink/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                    aria-label="Close"
                  >
                    <CloseIcon size={18} />
                  </button>
                )}
                <header className="text-center">
                  {eyebrow && (
                    <p className="font-ui text-[0.65rem] font-bold uppercase tracking-[0.4em] text-ink-soft/80">
                      {eyebrow}
                    </p>
                  )}
                  <h2 id={titleId} className="ink-bleed mt-1 font-display text-3xl text-ink sm:text-4xl">
                    {title}
                  </h2>
                  <InkFlourish className="mx-auto mt-2 w-40 text-ink-soft/70" />
                </header>
                <div className="mt-5 font-body text-lg leading-relaxed text-ink-soft">{children}</div>
                {footer && <footer className="mt-7 flex flex-wrap justify-center gap-3">{footer}</footer>}
              </div>
            </motion.div>
            <ScrollRod bottom />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ScrollRod({ bottom }: { bottom?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative z-10 h-4 rounded-full",
        "bg-[linear-gradient(180deg,#8a5a2b_0%,#4a2c14_45%,#2a180a_100%)] shadow-[0_4px_10px_rgba(0,0,0,0.7)]",
        bottom ? "-mt-1" : "-mb-1",
      )}
    >
      <span className="absolute -left-1 top-1/2 h-6 w-3 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff1c1,#c89b45_50%,#6f4f1c)]" />
      <span className="absolute -right-1 top-1/2 h-6 w-3 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff1c1,#c89b45_50%,#6f4f1c)]" />
    </div>
  );
}
