"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { newlyUnlocked, SLOTS, wearing, type Unlocked } from "@/lib/cosmetics";
import { recordVoyage, voyageKey } from "@/lib/game/career";
import type { AvatarId, PlayerId, RoomState } from "@/lib/socket/contract";
import { useSavedOutfit } from "@/lib/storage";
import { AvatarFrame } from "../avatar/AvatarFrame";
import { PirateAvatar } from "../avatar/PirateAvatar";
import { ShipFlag } from "../avatar/ShipFlag";
import { WardrobeButton } from "../avatar/WardrobeButton";

/** Recording is a write to storage, so it happens once per voyage and sailor even if the screen remounts. */
const recorded = new Map<string, Unlocked[]>();

function unlocksFor(room: RoomState, playerId: PlayerId): Unlocked[] {
  const key = `${voyageKey(room)}:${playerId}`;
  const cached = recorded.get(key);
  if (cached) return cached;
  const change = recordVoyage(room, playerId);
  const found = change ? newlyUnlocked(change.before, change.after) : [];
  recorded.set(key, found);
  return found;
}

const FLAG_SLOTS = new Set(["field", "emblem", "border"]);

/** Writes the finished voyage into this device's career and shows any wardrobe pieces it earned. */
export function ChestUnlocks({ room, meId, avatarId }: { room: RoomState; meId: PlayerId; avatarId: AvatarId }) {
  const [unlocks] = useState(() => unlocksFor(room, meId));
  const outfit = useSavedOutfit();
  if (unlocks.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2, duration: 0.6 }}
      className="mx-auto mt-8 max-w-2xl rounded-md border-2 border-dashed border-brass-dark/50 bg-brass/10 px-4 py-4"
      aria-label="Wardrobe pieces earned this voyage"
    >
      <p className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.35em] text-ink-soft/80">New in your sea chest</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-4">
        {unlocks.map(({ slot, piece }, i) => {
          const tried = wearing(outfit, slot, piece.id);
          return (
            <motion.li
              key={`${slot}:${piece.id}`}
              initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 2.2 + i * 0.15, type: "spring", stiffness: 260, damping: 16 }}
              className="flex w-24 flex-col items-center gap-1 text-center"
              title={piece.flavour}
            >
              <span className="block aspect-square w-16 overflow-hidden rounded-full bg-sea shadow-[0_0_0_2px_rgba(200,155,69,0.6),0_0_18px_rgba(255,216,115,0.45)]">
                {FLAG_SLOTS.has(slot) ? (
                  <ShipFlag flag={tried.flag} pole={false} className="h-full w-full p-2" />
                ) : slot === "frame" ? (
                  <AvatarFrame frame={tried.frame} className="h-full w-full">
                    <PirateAvatar avatarId={avatarId} outfit={tried} className="h-full w-full" />
                  </AvatarFrame>
                ) : (
                  <PirateAvatar avatarId={avatarId} outfit={tried} className="h-full w-full" />
                )}
              </span>
              <span className="font-display text-base leading-tight text-ink">{piece.name}</span>
              <span className="font-ui text-[0.5rem] font-bold uppercase tracking-[0.2em] text-ink-soft/70">{SLOTS[slot].label}</span>
            </motion.li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-center">
        <WardrobeButton avatarId={avatarId} />
      </div>
    </motion.section>
  );
}
