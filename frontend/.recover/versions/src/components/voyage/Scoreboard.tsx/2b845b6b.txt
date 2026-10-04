"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { findPlayer } from "@/lib/game/selectors";
import { SCORE_RULES, type RoomState, type ScoreEntry } from "@/lib/socket/contract";
import { PirateAvatar } from "../avatar/PirateAvatar";
import { CrownIcon, InfoIcon, PodiumIcon } from "../icons";

const RANK_STYLE: Record<number, string> = {
  1: "border-gold/70 bg-gold/15 text-gold",
  2: "border-parchment/50 bg-parchment/10 text-parchment",
  3: "border-ember/60 bg-ember/10 text-ember",
};

const RULES: { label: string; value: number }[] = [
  { label: "Riddle solved", value: SCORE_RULES.perSolve },
  { label: "Relic held", value: SCORE_RULES.perRelic },
  { label: "Strike taken", value: SCORE_RULES.perStrike },
  { label: "Whisper bought", value: SCORE_RULES.perHint },
  { label: "Opening the Vault", value: SCORE_RULES.treasure },
  { label: "Each spare minute (Vault opener)", value: SCORE_RULES.perMinuteSpare },
];

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Live standings. Scores are computed by the server; this only ranks and explains them. */
export function Scoreboard({ room, meId, scores }: { room: RoomState; meId: string; scores?: ScoreEntry[] }) {
  const [showRules, setShowRules] = useState(false);
  const rows = scores ?? room.scores;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-ui text-[0.58rem] uppercase tracking-[0.3em] text-brass/70">
          <PodiumIcon size={13} /> Standings
        </p>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          className="flex items-center gap-1 font-ui text-[0.55rem] uppercase tracking-[0.2em] text-brass/60 transition hover:text-brass-light"
        >
          <InfoIcon size={12} /> How scoring works
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showRules && (
          <motion.dl
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 overflow-hidden rounded border border-brass/15 bg-abyss/40 px-3 py-2 font-body text-sm"
          >
            {RULES.map((rule) => (
              <div key={rule.label} className="contents">
                <dt className="text-parchment/70">{rule.label}</dt>
                <dd className={cn("text-right font-ui tabular-nums", rule.value < 0 ? "text-blood-light" : "text-kelp-light")}>
                  {signed(rule.value)}
                </dd>
              </div>
            ))}
          </motion.dl>
        )}
      </AnimatePresence>

      <ol className="mt-3 space-y-2">
        {rows.length === 0 && <li className="font-body italic text-parchment/40">No scores yet.</li>}
        {rows.map((row) => {
          const player = findPlayer(room, row.playerId);
          const isMe = row.playerId === meId;
          return (
            <motion.li
              key={row.playerId}
              layout
              className={cn(
                "flex items-center gap-3 rounded-md border bg-abyss/40 p-2.5",
                isMe ? "border-gold/40" : "border-brass/15",
                player?.isEliminated && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-ui text-xs font-bold",
                  RANK_STYLE[row.rank] ?? "border-brass/25 text-brass/70",
                )}
                aria-label={`Rank ${row.rank}`}
              >
                {row.rank}
              </span>
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-brass/40">
                {player && <PirateAvatar avatarId={player.avatarId} outfit={player.outfit} faded={player.isEliminated} className="h-full w-full" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-display text-lg leading-none text-parchment">
                  {room.winnerPlayerId === row.playerId && <CrownIcon size={13} className="shrink-0 text-gold" aria-label="Winner" />}
                  <span className="truncate">{isMe ? "You" : player?.username ?? "A departed sailor"}</span>
                </p>
                <p className="mt-1 font-ui text-[0.55rem] uppercase tracking-[0.15em] text-brass/60">
                  {row.solved} solved · {count(row.relics, "relic", "relics")} ·{" "}
                  {count(row.strikes, "strike", "strikes")} · {count(row.hintsUsed, "whisper", "whispers")}
                </p>
              </div>
              <span className={cn("shrink-0 font-display text-2xl tabular-nums", row.score < 0 ? "text-blood-light" : "text-gold")}>
                {row.score.toLocaleString()}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
