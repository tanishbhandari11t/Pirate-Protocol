"use client";

import { useCallback, useEffect, useState } from "react";
import { emitWithAck, type AckSocket } from "@/lib/socket/emitWithAck";
import { cleanMarkRequest, type MapMark, type MarkKind, type MarkPoint, type MarksPush } from "@/lib/socket/marks";

export type MarksSocket = AckSocket;

const FRIENDLY: Record<string, string> = {
  RATE_LIMITED: "Easy on the ink, sailor. Try again in a moment.",
  NOT_ALLOWED: "Only sailors still aboard can mark the chart.",
  INVALID_PAYLOAD: "That mark wouldn't hold on the chart.",
  NOT_FOUND: "That mark has already faded.",
  NOT_IN_ROOM: "You're not aboard this voyage.",
  UNSUPPORTED: "This harbour doesn't share chart marks.",
  TIMEOUT: "The chart didn't answer. Check your connection.",
};

/**
 * Shared chart marks for the current room. The server pushes the full set after every change, so the
 * hook never patches locally; placing a mark is just a request.
 */
export function useMapMarks(socket: MarksSocket | null) {
  const [marks, setMarks] = useState<MapMark[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onMarks = (push: MarksPush) => setMarks(Array.isArray(push?.marks) ? push.marks : []);
    socket.on("map:marks", onMarks);
    return () => {
      socket.off("map:marks", onMarks);
    };
  }, [socket]);

  const fail = useCallback((e: unknown) => {
    const code = (e as { code?: string })?.code ?? "UNKNOWN";
    setError(FRIENDLY[code] ?? (e as { message?: string })?.message ?? "The mark didn't take.");
  }, []);

  const place = useCallback(
    async (kind: MarkKind, points: MarkPoint[]) => {
      if (!socket) return false;
      const payload = cleanMarkRequest({ kind, points });
      if (!payload) return false;
      setError(null);
      try {
        await emitWithAck<MapMark>(socket, "map:mark", payload);
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [socket, fail],
  );

  const remove = useCallback(
    async (markId: string) => {
      if (!socket) return false;
      setError(null);
      try {
        await emitWithAck<null>(socket, "map:unmark", { markId });
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [socket, fail],
  );

  return { marks, place, remove, error, clearError: () => setError(null) };
}
