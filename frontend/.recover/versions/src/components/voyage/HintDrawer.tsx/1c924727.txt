"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useCrew } from "@/lib/crew/CrewProvider";
import { hintsFor } from "@/lib/crew/reducer";
import type { HintPayment, PublicPuzzle } from "@/lib/socket/contract";
import { describeError } from "@/lib/socket/errors";
import { playSfx } from "@/lib/sound";
import { LightbulbIcon, ScrollIcon, SkullIcon } from "../icons";

/**
 * Hints for one puzzle, styled for the parchment puzzle card. The server decides what each hint
 * says and charges for it; this drawer only shows what has been bought and offers the next one.
 */
export function HintDrawer({ puzzle }: { puzzle: PublicPuzzle }) {
  const { state, sailor, buyHint, pending } = useCrew();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = state.room?.settings;
  if (!settings || !sailor) return null;

  const bought = hintsFor(state, puzzle.key);
  const left = puzzle.hintCount - bought.length;
  const rumors = state.you.find((i) => i.itemKey === "tide-rumor")?.quantity ?? 0;
  const strikeAffordable = sailor.strikes + 1 < settings.maxStrikes;
  const busy = pending.has("puzzle:hint");

  const buy = async (payWith: HintPayment) => {
    setError(null);
    const res = await buyHint(puzzle.key, payWith);
    if (res.ok) playSfx("solve");
    else setError(describeError(res.error.code, res.error.message));
  };

  if (!settings.hintsEnabled) {
    return (
      <p className="mt-5 text-center font-body text-sm italic text-ink-soft/70">
        The captain&apos;s articles forbid hints on this voyage.
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-ink/20 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.3em] text-ink-soft transition hover:text-ink"
      >
        <LightbulbIcon size={14} />
        {bought.length > 0 ? `Whispers bought · ${bought.length}/${puzzle.hintCount}` : "Buy a whisper"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {bought.length > 0 && (
              <ol className="mt-3 space-y-2">
                {bought.map((hint) => (
                  <li key={hint.level} className="flex gap-2 rounded-sm bg-parchment-light/60 px-3 py-2 font-body text-ink">
                    <span className="font-display text-lg leading-none text-blood/70">{hint.level}.</span>
                    <span className="leading-snug">{hint.text}</span>
                  </li>
                ))}
              </ol>
            )}

            {left > 0 ? (
              <div className="mt-3 text-center">
                <p className="font-body text-sm italic text-ink-soft">
                  {left === puzzle.hintCount ? "The island will sell its secrets — for a price." : `${left} more ${left === 1 ? "whisper" : "whispers"} for sale.`}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <PayButton
                    onClick={() => buy("strike")}
                    disabled={busy || !strikeAffordable}
                    title={strikeAffordable ? "Take a strike to hear the next whisper" : "Another strike would send you to the deep"}
                  >
                    <SkullIcon size={13} /> Pay a strike
                  </PayButton>
                  <PayButton
                    onClick={() => buy("tide-rumor")}
                    disabled={busy || rumors < 1}
                    title={rumors > 0 ? "Trade a Tide Rumor for the next whisper" : "You hold no Tide Rumor"}
                  >
                    <ScrollIcon size={13} /> Pay a rumour {rumors > 0 && `(${rumors})`}
                  </PayButton>
                </div>
                <p className="mt-2 font-ui text-[0.55rem] uppercase tracking-[0.2em] text-ink-soft/60">
                  Every whisper costs 25 points on the final tally
                </p>
              </div>
            ) : (
              <p className="mt-3 text-center font-body text-sm italic text-ink-soft">The island has no more secrets to sell.</p>
            )}

            {error && (
              <p role="alert" className="mt-2 text-center font-body text-sm italic text-blood">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PayButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 rounded-sm border border-ink/40 bg-parchment-light/50 px-3 py-1.5 font-ui text-[0.62rem] font-bold uppercase tracking-wider text-ink transition enabled:hover:bg-parchment-light disabled:opacity-40"
    >
      {children}
    </button>
  );
}
