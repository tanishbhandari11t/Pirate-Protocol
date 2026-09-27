"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { CaptainOrders } from "@/components/lobby/CaptainOrders";
import { CrewMemberCard, EmptyBerth } from "@/components/lobby/CrewMemberCard";
import { RoomCodePlaque } from "@/components/lobby/RoomCodePlaque";
import { ShipsLog } from "@/components/lobby/ShipsLog";
import { VoyageCountdown } from "@/components/lobby/VoyageCountdown";
import { UsersIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/Loader";
import { Modal } from "@/components/ui/Modal";
import { useNotify } from "@/components/ui/Notifications";
import { useCrew } from "@/lib/crew/CrewProvider";
import { describeError } from "@/lib/socket/errors";
import { seatStore } from "@/lib/storage";
import { sanitizeRoomCode } from "@/lib/validation";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = sanitizeRoomCode(params.code ?? "");
  const router = useRouter();
  const { notify } = useNotify();
  const { state, me, isCaptain, rejoinCrew, leaveCrew, setReady, startVoyage } = useCrew();
  const seat = useSyncExternalStore(seatStore.subscribe, seatStore.getSnapshot, seatStore.getServerSnapshot);

  const [readyPending, setReadyPending] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rejoinAttempted = useRef(false);

  const room = state.room?.code === code ? state.room : null;
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
    if (room && (state.voyageStarted || room.phase === "in-game")) {
      router.push(`/voyage/${room.code}`);
    }
  }, [room, state.voyageStarted, router]);

  if (!room || !me) {
    return <LoadingScreen show message="Rowing back aboard" detail="Reclaiming your berth…" />;
  }

  const toggleReady = async () => {
    setReadyPending(true);
    const res = await setReady(!me.isReady);
    setReadyPending(false);
    if (!res.ok) notify({ tone: "danger", title: "Order refused", message: describeError(res.error.code) });
  };

  const start = async () => {
    setStartPending(true);
    const res = await startVoyage();
    setStartPending(false);
    if (!res.ok) notify({ tone: "danger", title: "The ship won't budge", message: describeError(res.error.code) });
  };

  const leave = async () => {
    setLeaving(true);
    await leaveCrew();
    router.push("/");
  };

  const emptyBerths = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <main className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <TopBar />

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-8 pt-1 sm:px-6 lg:min-h-0 lg:grid-cols-[1fr_20rem] lg:gap-8 lg:pb-6 xl:grid-cols-[1fr_22rem] xl:gap-12">
        <section className="lg:-ml-2 lg:min-h-0 lg:overflow-y-auto lg:p-2 lg:pr-3">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="mb-6 short:mb-4"