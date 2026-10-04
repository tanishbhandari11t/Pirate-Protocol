"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { AnchorIcon, CheckIcon, CloseIcon, InfoIcon, SkullIcon, WarningIcon } from "../icons";

export type NotificationTone = "info" | "success" | "warning" | "danger";

export interface NotificationInput {
  title: string;
  message?: string;
  tone?: NotificationTone;
  /** Milliseconds before auto-dismiss; 0 keeps it until closed. */
  duration?: number;
}

interface NotificationItem extends Required<Omit<NotificationInput, "message">> {
  id: number;
  message?: string;
}

interface NotificationApi {
  notify: (input: NotificationInput) => number;
  dismiss: (id: number) => void;
}

const NotificationContext = createContext<NotificationApi | null>(null);

const TONES: Record<NotificationTone, { icon: ReactNode; accent: string; bar: string }> = {
  info: { icon: <InfoIcon size={18} />, accent: "text-foam border-foam/40", bar: "bg-foam/70" },
  success: { icon: <CheckIcon size={18} />, accent: "text-kelp-light border-kelp-light/50", bar: "bg-kelp-light/80" },
  warning: { icon: <WarningIcon size={18} />, accent: "text-gold border-gold/50", bar: "bg-gold/80" },
  danger: { icon: <SkullIcon size={18} />, accent: "text-[#f2a097] border-blood-light/60", bar: "bg-blood-light/90" },
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const id = nextId.current++;
    const item: NotificationItem = {
      id,
      title: input.title,
      message: input.message,
      tone: input.tone ?? "info",
      duration: input.duration ?? 4800,
    };
    setItems((list) => [...list.slice(-3), item]);
    return id;
  }, []);

  const api = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Toast key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: number) => void }) {
  const tone = TONES[item.tone];

  useEffect(() => {
    if (!item.duration) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, rotate: 2 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="wood-panel pointer-events-auto relative overflow-hidden rounded-md"
      role={item.tone === "danger" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-abyss/60", tone.accent)}>
          {tone.icon}
        </span>
        <div className="min-w-0">
          <p className="font-ui text-xs font-bold uppercase tracking-[0.2em] text-parchment">{item.title}</p>
          {item.message && <p className="mt-1 font-body text-[0.95rem] leading-snug text-parchment/75">{item.message}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="absolute right-2 top-2 rounded p-1 text-parchment/50 transition hover:text-parchment focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
        aria-label="Dismiss notification"
      >
        <CloseIcon size={14} />
      </button>
      {item.duration > 0 && (
        <motion.span
          className={cn("absolute bottom-0 left-0 h-[2px] w-full origin-left", tone.bar)}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: item.duration / 1000, ease: "linear" }}
        />
      )}
      <AnchorIcon size={64} className="pointer-events-none absolute -bottom-4 -right-3 text-brass/[0.07]" />
    </motion.div>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotify must be used inside <NotificationProvider>");
  return ctx;
}
