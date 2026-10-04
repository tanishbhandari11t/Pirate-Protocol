"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Ornaments";
import { LoadingScreen } from "@/components/ui/Loader";
import { useNotify } from "@/components/ui/Notifications";
import { VoyageBoard } from "@/components/voyage/VoyageBoard";
import { useCrew } from "@/lib/crew/CrewProvider";
import { bareShipName } from "@/lib/names";
import { describeError } from "@/lib/socket/errors";
import { seatStore } from "@/lib/storage";
import { sanitizeRoomCode } from "@/lib/validation";

/**
 * The living map. After the crew sets sail, every sailor sees their own orders
 * and the shared watch list, then names the island and digs up the hoard.
 */
export default function VoyagePage() {
  const params = useParams<{ code: string }>();
  const code = sanitizeRoomCode(params.code ?? "");
  const router = useRouter();
  const { notify } = useNotify();
  const { state, rejoinCrew, leaveCrew, syncVoyage, actOnVoyage } = useCrew();
  const seat = useSyncExternalStore(seatStore.subscribe, seatStore.getSnapshot, seatStore.getServerSnapshot);

  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const rejoinAttempted = useRef(false);
  const syncAttempted = useRef(false);

  const room = state.room?.code === code ? state.room : null;
  const voyage = state.voyage?.roomCode === code ? state.voyage : null;
  const hasSeat = seat?.roomCode === code;

  useEffect(() => {
    if (room || leaving) return;
    if (!hasSeat) {
      router.replace(`/crew/join?code=${code}`);
      return;
    }
    if (rejoinAttempted.current) return;
    rejoinAttempted.current = true;
    rejoinCrew(code).then((res) => {
      if (!res.ok) {
        notify({ tone: "danger", title: "Could not reclaim your berth", message: describeError(res.error.code) });
        router.replace(`/crew/join?code=${code}`);
      }
    });
  }, [room, hasSeat, code, leaving, rejoinCrew, router, notify]);

  useEffect(() => {
    if (room && room.phase === "lobby" && !state.voyageStarted) router.replace(`/lobby/${code}`);
  }, [room, state.voyageStarted, code, router]);

  useEffect(() => {
    if (!room || voyage || room.phase === "lobby") return;
    if (syncAttempted.current) return;
    syncAttempted.current = true;
    syncVoyage().then((res) => {
      if (!res.ok) setSyncFailed(true);
    });
  }, [room, voyage, syncVoyage]);

  const act = async (payload: Parameters<typeof actOnVoyage>[0]) => {
    setPending(true);
    const res = await actOnVoyage(payload);
    setPending(false);
    if (!res.ok) {
      const text = describeError(res.error.code);
      setFeedback({ ok: false, text });
      notify({ tone: "danger", title: "Order refused", message: text });
      return;
    }
    setFeedback({ ok: res.data.correct, text: res.data.message });
    if (!res.data.correct) notify({ tone: "warning", title: "Not that", message: res.data.message });
  };

  const leave = async () => {
    setLeaving(true);
    await leaveCrew();
    router.push("/");
  };

  if (!room || !voyage) {
    return (
      <LoadingScreen
        show
        message={syncFailed ? "The map stayed dark" : "The map is waking"}
        detail={
          syncFailed
            ? "The harbour did not send your orders. Return to the ship and set sail again."
            : room
              ? `Unrolling orders for the ${bareShipName(room.crewName)}…`
              : "Reclaiming your berth…"
        }
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar>
        <Badge tone="kelp">Ship {code}</Badge>
      </TopBar>
      <VoyageBoard
        voyage={voyage}
        pending={pending}
        feedback={feedback}
        leaving={leaving}
        onAct={(kind, choice) => act({ kind, choice })}
        onLeave={leave}
      />
    </main>
  );
}
