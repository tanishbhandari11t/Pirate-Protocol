"use client";

import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { cn } from "@/lib/cn";
import { useGambit } from "@/lib/game/useGambit";
import type { AckSocket } from "@/lib/socket/emitWithAck";
import { diceTotal, roundsWon, type GambitDuel } from "@/lib/socket/gambit";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

function Die({ value, delay = 0 }: { value: number; delay?: number }) {
  const still = useReducedMotionConfig();
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="h-7 w-7"
      initial={still ? false : { rotate: -200, scale: 0.4, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16, delay }}
      role="img"
      aria-label={`a ${value}`}
    >
      <rect x="6" y="6" width="88" height="88" rx="18" fill="#f4e4c1" stroke="#2b1d0e" strokeWidth="5" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="#2b1d0e" />
      ))}
    </motion.svg>
  );
}

interface GambitPanelProps {
  socket: AckSocket | null;
  meId: string;
  crew: { id: string; name: string; canPlay: boolean }[];
  className?: string;
}

/** Captain's Gambit: challenge a crewmate to a best-of-three dice duel. The server rolls. */
export function GambitPanel({ socket, meId, crew, className }: GambitPanelProps) {
  const { live, latest, challenge, respond, error } = useGambit(socket);
  const duel: GambitDuel | null = live ?? latest;
  const nameOf = (id: string) => (id === meId ? "You" : (crew.find((c) => c.id === id)?.name ?? "A sailor"));
  const rivals = crew.filter((c) => c.id !== meId);

  return (
    <section className={cn("rounded-md border border-brass/25 bg-abyss/40 p-3", className)} aria-labelledby="gambit-title">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="gambit-title" className="font-display text-lg text-gold">
          Captain&apos;s Gambit
        </h3>
        <span className="font-ui text-[0.55rem] uppercase tracking-[0.2em] text-brass/60">Best of three · for honour</span>
      </div>

      {!live && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {rivals.length === 0 && <li className="font-body text-sm italic text-parchment/60">No one to dice with yet.</li>}
          {rivals.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={!r.canPlay}
                onClick={() => challenge(r.id)}
                className="rounded border border-brass/40 px-2 py-1 font-ui text-[0.6rem] uppercase tracking-[0.15em] text-brass-light transition hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎲 Dice {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence mode="wait">
        {duel && (
          <motion.div
            key={duel.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded border border-brass/20 bg-deep/60 p-2.5"
            aria-live="polite"
          >
            <p className="font-body text-sm text-parchment">
              <strong className="text-gold">{nameOf(duel.challengerId)}</strong> vs{" "}
              <strong className="text-gold">{nameOf(duel.defenderId)}</strong>
              <span className="ml-2 font-ui text-[0.6rem] uppercase tracking-[0.15em] text-brass/70">
                {roundsWon(duel, "challenger")} – {roundsWon(duel, "defender")}
              </span>
            </p>

            {duel.status === "pending" && duel.defenderId === meId && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => respond(duel.id, true)}
                  className="rounded bg-brass px-3 py-1 font-ui text-[0.6rem] font-bold uppercase tracking-[0.15em] text-ink hover:bg-gold"
                >
                  Roll the bones
                </button>
                <button
                  type="button"
                  onClick={() => respond(duel.id, false)}
                  className="rounded border border-brass/40 px-3 py-1 font-ui text-[0.6rem] uppercase tracking-[0.15em] text-brass-light"
                >
                  Decline
                </button>
              </div>
            )}
            {duel.status === "pending" && duel.challengerId === meId && (
              <p className="mt-1 font-body text-sm italic text-parchment/70">Waiting for {nameOf(duel.defenderId)} to pick up the cup…</p>
            )}

            <ol className="mt-2 space-y-1.5">
              {duel.rounds.map((round, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-12 font-ui text-[0.55rem] uppercase tracking-[0.15em] text-brass/60">Round {i + 1}</span>
                  <span className={cn("flex gap-0.5", round.winner === "challenger" && "drop-shadow-[0_0_6px_rgba(255,216,115,0.8)]")}>
                    {round.challenger.map((v, j) => (
                      <Die key={j} value={v} delay={j * 0.08} />
                    ))}
                  </span>
                  <span className="font-ui text-[0.6rem] text-parchment/70">
                    {diceTotal(round.challenger)}:{diceTotal(round.defender)}
                  </span>
                  <span className={cn("flex gap-0.5", round.winner === "defender" && "drop-shadow-[0_0_6px_rgba(255,216,115,0.8)]")}>
                    {round.defender.map((v, j) => (
                      <Die key={j} value={v} delay={0.25 + j * 0.08} />
                    ))}
                  </span>
                </li>
              ))}
            </ol>

            {duel.status === "rolling" && <p className="mt-1 font-body text-sm italic text-parchment/70">The dice are flying…</p>}
            {duel.status === "done" && (
              <p className="mt-2 font-display text-base text-gold">
                {duel.winnerId ? `${nameOf(duel.winnerId)} ${duel.winnerId === meId ? "win" : "wins"} the gambit!` : "Honours even. The cup goes back on the shelf."}
              </p>
            )}
            {duel.status === "declined" && <p className="mt-1 font-body text-sm italic text-parchment/70">{nameOf(duel.defenderId)} declined the wager.</p>}
            {duel.status === "expired" && <p className="mt-1 font-body text-sm italic text-parchment/70">The wager lapsed.</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-2 font-body text-sm text-blood-light">{error}</p>}
    </section>
  );
}
