"use client";

import { useCallback, useEffect, useState } from "react";
import { emitWithAck, type AckSocket } from "@/lib/socket/emitWithAck";
import { isLiveDuel, type GambitDuel } from "@/lib/socket/gambit";

const FRIENDLY: Record<string, string> = {
  RATE_LIMITED: "Catch your breath before the next wager.",
  NOT_ALLOWED: "One of you is already mid-wager.",
  BAD_RECIPIENT: "That sailor isn't at the table.",
  NOT_FOUND: "That wager is no longer on the table.",
  UNSUPPORTED: "This harbour doesn't allow dice.",
  TIMEOUT: "The dice cup went quiet. Check your connection.",
};

/** Every duel this sailor is part of, as the server last described it. */
export function useGambit(socket: AckSocket | null) {
  const [duels, setDuels] = useState<Record<string, GambitDuel>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (duel: GambitDuel) => {
      if (!duel?.id) return;
      setDuels((all) => ({ ...all, [duel.id]: duel }));
    };
    socket.on("gambit:update", onUpdate);
    return () => {
      socket.off("gambit:update", onUpdate);
    };
  }, [socket]);

  const run = useCallback(
    async (event: string, payload: unknown) => {
      if (!socket) return null;
      setError(null);
      try {
        const duel = await emitWithAck<GambitDuel>(socket, event, payload);
        setDuels((all) => ({ ...all, [duel.id]: duel }));
        return duel;
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "UNKNOWN";
        setError(FRIENDLY[code] ?? (e as { message?: string })?.message ?? "The dice slipped.");
        return null;
      }
    },
    [socket],
  );

  const challenge = useCallback((toPlayerId: string) => run("gambit:challenge", { toPlayerId }), [run]);
  const respond = useCallback((duelId: string, accept: boolean) => run("gambit:respond", { duelId, accept }), [run]);

  const list = Object.values(duels).sort((a, b) => b.createdAt - a.createdAt);
  const live = list.find(isLiveDuel) ?? null;
  const latest = list[0] ?? null;
  return { duels: list, live, latest, challenge, respond, error };
}
