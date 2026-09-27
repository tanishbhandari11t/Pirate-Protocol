"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/cn";
import type { PlayerSnapshot } from "@/lib/socket/contract";
import { PirateAvatar } from "../avatar/PirateAvatar";
import { Porthole } from "../avatar/Porthole";
import { CrownIcon, HourglassIcon } from "../icons";
import { Badge, Seal } from "../ui/Ornaments";
import { ParchmentBackdrop } from "../ui/ParchmentBackdrop";
import { Tooltip } from "../ui/Tooltip";

interface CrewMemberCardProps {
  player: PlayerSnapshot;
  isMe: boolean;
}

export function CrewMemberCard({ player, isMe }: CrewMemberCardProps) {
  const avatar = AVATARS[player.avatarId];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30, rotateY: -70 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      exit={{ opacity: 0, scale: 0.85, filter: "blur(6px)" }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
      style={{ transformPerspective: 900 }}
      className="relative text-ink"
      aria-label={`${player.name}${player.isCaptain ? ", captain" : ""}, ${player.isReady ? "ready" : "not ready"}`}
    >
      <ParchmentBackdrop variant={player.joinedAt} />
      {isMe && (
        <div aria-hidden className="absolute -inset-1 rounded-md ring-2 ring-gold/60 shadow-[0_0_24px_rgba(255,216,115,0.35)]" />
      )}

      <div className="relative flex flex-col items-center px-3 pb-4 pt-5 text-center sm:px-4 short:pb-3 short:pt-4">
        {player.isCaptain && (
          <div className="absolute left-3 top-3">
            <Tooltip content="Captain of this crew">
              <span tabIndex={0} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-gold shadow-md">
                <CrownIcon size={16} />
              </span>
            </Tooltip>
          </div>
        )}

        <Porthole className="w-20 sm:w-24 short:w-[4.5rem]" glow={player.isReady}>
          <PirateAvatar avatarId={player.avatarId} faded={!player.isConnected} className="h-full w-full" />
        </Porthole>

        <h3 className="ink-bleed mt-3 w-full truncate font-display text-xl leading-tight sm:text-2xl short:mt-2">
          {player.name}
        </h3>
        <p className="font-body text-sm italic text-ink-soft/80">{avatar.title}</p>

        <div className="mt-2 flex h-5 items-center gap-1.5">
          {isMe && <Badge tone="blood" className="border-blood/50 bg-blood/10 text-blood">You</Badge>}
          {!player.isConnected && <Badge tone="fog" className="border-ink-soft/30 bg-ink/10 text-ink-soft">Lost in fog</Badge>}
        </div>

        <div className="mt-3 h-12 short:mt-1.5">
          <AnimatePresence mode="wait" initial={false}>
            {player.isReady ? (
              <motion.div
                key="ready"
                initial={{ scale: 2.4, opacity: 0, rotate: -35 }}
                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                <Seal tone="kelp">Ready</Seal>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn("flex h-12 items-center gap-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.22em] text-ink-soft/70")}
              >
                <HourglassIcon size={16} className="animate-[spin_3s_ease-in-out_infinite]" /> Preparing
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

export function EmptyBerth({ index, className }: { index: number; className?: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        className,
        "flex h-full min-h-[16.5rem] flex-col items-center justify-center rounded-md border-2 border-dashed border-brass/20 bg-abyss/45 p-4 text-center sm:min-h-[17.75rem] short:min-h-[15rem]",