"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { achievementsFor, type Achievement } from "@/lib/game/achievements";
import type { RoomState } from "@/lib/socket/contract";
import { playSfx, vibrate } from "@/lib/sound";
import { CoinBurst } from "../fx/CoinBurst";
import { ItemGlyph } from "./ItemGlyph";

const SHOW_MS = 4_800;

interface Queue {
  /** Honours already shown or already held when the page opened. */
  known: string[];
  waiting: Achievement[];
}

/**
 * Announces an honour the moment the server's record earns it. Honours held when the page loads
 * are treated as old news, so a refresh never replays them.
 */
export function HonourToast({ room, meId }: { room: RoomState; meId: string }) {
  const earned = useMemo(() => achievementsFor(room, meId), [room, meId]);
  const [queue, setQueue] = useState<Queue>(() => ({ known: earned.map((a) => a.id), waiting: [] }));

  const fresh = earned.filter((a) => !queue.known.includes(a.id));
  if (fresh.length > 0) {
    setQueue({ known: [...queue.known, ...fresh.map((a) => a.id)], waiting: [...queue.waiting, ...fresh] });
  }

  const head = queue.waiting[0] ?? null;

  useEffect(() => {
    if (!head) return;
    playSfx("honour");
    vibrate([30, 40, 30]);
    const timer = window.setTimeout(() => setQueue((q) => ({ ...q, waiting: q.waiting.slice(1) })), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [head]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4" aria-live="polite">
      <AnimatePresence mode="wait">
        {head && (
          <motion.div
            key={head.id}
            role="status"
            className="pointer-events-auto relative flex max-w-md items-center gap-4 overflow-visible rounded-md border-2 border-gold/70 bg-[linear-gradient(135deg,#2a1a0a,#120a04)] px-5 py-3 shadow-[0_0_40px_rgba(255,216,115,0.35),0_18px_40px_rgba(0,0,0,0.7)]"
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95, transition: { duration: 0.35 } }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            onClick={() => setQueue((q) => ({ ...q, waiting: q.waiting.slice(1) }))}
          >
            <CoinBurst count={12} seed={head.id.length * 97} spread={140} size={12} />
            <motion.div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-abyss text-gold"
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <ItemGlyph glyph={head.glyph} size={30} strokeWidth={1.4} />
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                animate={{ boxShadow: ["0 0 0 0 rgba(255,216,115,0.6)", "0 0 0 14px rgba(255,216,115,0)"] }}
                transition={{ duration: 1.4, repeat: 2 }}
              />
            </motion.div>
            <div className="relative min-w-0">
              <p className="font-ui text-[0.55rem] font-bold uppercase tracking-[0.35em] text-brass-light">Honour earned</p>
              <p className="font-display text-2xl leading-tight text-gilded">{head.title}</p>
              <p className="font-body text-sm italic text-parchment/80">{head.description}</p>
            </div>
            <motion.span
              aria-hidden
              className="absolute inset-x-3 bottom-0 h-0.5 origin-left bg-gold/70"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: SHOW_MS / 1000, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
