"use client";

import { useEffect, useMemo, useState } from "react";
import { describeEvent, moveCount, replayFrame } from "@/lib/game/selectors";
import type { RoomState } from "@/lib/socket/contract";
import { ShipIcon } from "../icons";
import { Button } from "../ui/Button";
import { VoyageMap } from "./VoyageMap";

const STEP_MS = 900;
const ignore = () => undefined;

/** Sails every recorded move again, in order, on a fully charted copy of the map. */
export function VoyageReplay({ room, meId }: { room: RoomState; meId: string }) {
  const total = moveCount(room);
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (step >= total) setPlaying(false);
      else setStep(step + 1);
    }, step === 0 ? 600 : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, step, total]);

  const { frame, event } = useMemo(() => replayFrame(room, step), [room, step]);
  const charted = useMemo(() => new Set(room.islands.map((i) => i.key)), [room.islands]);

  if (total === 0) return null;

  return (
    <section className="mx-auto mt-8 max-w-2xl text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.35em] text-ink-soft/80">The voyage, retold</p>
        <Button
          size="sm"
          variant="parchment"
          icon={<ShipIcon size={14} />}
          disabled={playing}
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
        >
          {playing ? "Sailing…" : "Replay"}
        </Button>
      </div>
      <VoyageMap
        room={frame}
        meId={meId}
        charted={charted}
        vaultOpen
        selectedKey={null}
        sailingTo={null}
        fogSurge={false}
        onSelect={ignore}
        dayCycle={false}
        interactive={false}
        className="mt-2 aspect-[5/3] w-full"
      />
      <p className="mt-2 flex justify-between gap-3 font-body italic text-ink-soft" aria-live="polite">
        <span>{event ? describeEvent(room, event, meId).text : "All hands gather at Port Royal."}</span>
        <span className="shrink-0 font-ui text-xs not-italic tabular-nums">
          {step}/{total}
        </span>
      </p>
    </section>
  );
}
