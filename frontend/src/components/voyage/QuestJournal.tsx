"use client";

import { motion, useReducedMotionConfig } from "framer-motion";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { solvedKeys } from "@/lib/game/selectors";
import type { PublicIsland, RoomState } from "@/lib/socket/contract";

interface QuestJournalProps {
  room: RoomState;
  meId: string;
  charted: ReadonlySet<string>;
  onFocusIsland?: (islandKey: string) => void;
}

const pinKey = (code: string) => `pp:journal-pins:${code}`;

function readPins(code: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.sessionStorage.getItem(pinKey(code)) ?? "[]");
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function Stamp() {
  const still = useReducedMotionConfig();
  return (
    <motion.span
      initial={still ? false : { scale: 2.4, rotate: -30, opacity: 0 }}
      animate={{ scale: 1, rotate: -12, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 14 }}
      className="absolute -right-1 -top-2 rounded border-2 border-blood px-1.5 font-display text-xs uppercase tracking-widest text-blood"
      aria-label="Solved"
    >
      Solved
    </motion.span>
  );
}

function InkLine({ children }: { children: string }) {
  const still = useReducedMotionConfig();
  return (
    <motion.span
      className="inline-block"
      animate={still ? undefined : { opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}

/**
 * The sailor's journal: every charted island, its riddles as handwritten notes, solved ones stamped,
 * open mysteries still wet with ink, and the hints this sailor paid for threaded beneath. Pins are
 * a private bookmark kept in this tab.
 */
export function QuestJournal({ room, meId, charted, onFocusIsland }: QuestJournalProps) {
  const solved = useMemo(() => solvedKeys(room, meId), [room, meId]);
  const [pins, setPins] = useState<string[]>(() => readPins(room.code));

  const togglePin = (islandKey: string) => {
    const next = pins.includes(islandKey) ? pins.filter((k) => k !== islandKey) : [...pins, islandKey];
    setPins(next);
    try {
      window.sessionStorage.setItem(pinKey(room.code), JSON.stringify(next));
    } catch {
      /* pins just won't survive a refresh */
    }
  };

  const islands = room.islands
    .filter((i) => charted.has(i.key) && i.puzzles.length > 0)
    .sort((a, b) => Number(pins.includes(b.key)) - Number(pins.includes(a.key)) || a.order - b.order);
  const hintsFor = (puzzleKey: string) => room.hints.filter((h) => h.puzzleKey === puzzleKey).sort((a, b) => a.level - b.level);
  const openCount = islands.reduce((n, i) => n + i.puzzles.filter((p) => !solved.has(p.key)).length, 0);
  const relics = room.you.filter((i) => i.quantity > 0);

  if (islands.length === 0) {
    return <p className="p-2 font-body italic text-parchment/70">The journal is blank. Land on an island to start writing.</p>;
  }

  const card = (island: PublicIsland) => {
    const pinned = pins.includes(island.key);
    return (
      <li key={island.key} className={cn("parchment relative rounded-md px-3 py-2.5 text-ink", pinned && "ring-2 ring-gold/80")}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onFocusIsland?.(island.key)}
            className="text-left font-display text-lg leading-tight text-ink hover:underline"
          >
            {island.name}
          </button>
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => togglePin(island.key)}
            title={pinned ? "Unpin" : "Pin to the top"}
            className={cn("shrink-0 rounded px-1.5 text-sm", pinned ? "text-blood" : "text-ink/40 hover:text-ink")}
          >
            📌
          </button>
        </div>
        <p className="font-body text-sm italic text-ink-soft">{island.description}</p>
        <ul className="mt-2 space-y-2 border-l-2 border-dashed border-ink/25 pl-3">
          {island.puzzles.map((puzzle) => {
            const done = solved.has(puzzle.key);
            const hints = hintsFor(puzzle.key);
            return (
              <li key={puzzle.key} className="relative pr-12">
                {done && <Stamp />}
                <p className={cn("font-body text-[0.95rem] text-ink", done && "opacity-70")}>
                  {done ? `“${puzzle.prompt}”` : <InkLine>{`“${puzzle.prompt}”`}</InkLine>}
                </p>
                {hints.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {hints.map((h) => (
                      <li key={h.level} className="flex gap-1.5 font-body text-sm text-ink-soft">
                        <span aria-hidden className="text-brass-dark">↳</span>
                        <span>
                          <span className="font-ui text-[0.55rem] uppercase tracking-[0.15em] text-ink/50">Hint {h.level} · </span>
                          {h.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-ui text-[0.6rem] uppercase tracking-[0.18em] text-brass/80">
        <span>{islands.length} shores charted</span>
        <span aria-hidden>·</span>
        <span>{openCount} mysteries open</span>
        {relics.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>Carrying: {relics.map((r) => r.name).join(", ")}</span>
          </>
        )}
      </div>
      <ul className="space-y-3">{islands.map(card)}</ul>
    </div>
  );
}
