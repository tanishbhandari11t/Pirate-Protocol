"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeReactions, REACTION_MS, reactionsFor, type Reaction } from "@/lib/game/reactions";
import type { PlayerId, RoomCode } from "@/lib/socket/contract";
import { useServerEvent } from "@/lib/socket/hooks";

/**
 * Live reactions for each sailor in one voyage, driven by `game:event` pushes. Each reaction fades
 * on its own timer; a newer one for the same sailor replaces it.
 */
export function useCrewReactions(roomCode: RoomCode | null | undefined): Record<PlayerId, Reaction> {
  const [reactions, setReactions] = useState<Record<PlayerId, Reaction>>({});
  const timers = useRef(new Map<PlayerId, ReturnType<typeof setTimeout>>());

  const expire = useCallback((reaction: Reaction) => {
    const existing = timers.current.get(reaction.playerId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      reaction.playerId,
      setTimeout(() => {
        timers.current.delete(reaction.playerId);
        setReactions((current) => {
          if (current[reaction.playerId]?.eventId !== reaction.eventId) return current;
          const next = { ...current };
          delete next[reaction.playerId];
          return next;
        });
      }, REACTION_MS),
    );
  }, []);

  useServerEvent("game:event", (event) => {
    if (!roomCode || event.roomCode !== roomCode) return;
    const incoming = reactionsFor(event);
    if (incoming.length === 0) return;
    setReactions((current) => mergeReactions(current, incoming));
    incoming.forEach(expire);
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return reactions;
}
