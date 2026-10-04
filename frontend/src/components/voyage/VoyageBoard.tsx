"use client";

import { DoorIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Ornaments";
import { Panel } from "@/components/ui/Panel";
import { ParchmentCard } from "@/components/ui/ParchmentCard";
import { cn } from "@/lib/cn";
import type { VoyageSnapshot } from "@/lib/socket/contract";

const STEP: Record<VoyageSnapshot["phase"], string> = {
  duties: "Step 1 of 2 · Keep Your Watch",
  chart: "Step 2 of 2 · Name the Island",
  won: "The Hoard Is Yours",
  lost: "The Hoard Is Lost",
};

export function VoyageBoard({
  voyage,
  pending,
  feedback,
  leaving,
  onAct,
  onLeave,
}: {
  voyage: VoyageSnapshot;
  pending: boolean;
  feedback: { ok: boolean; text: string } | null;
  leaving: boolean;
  onAct: (kind: "duty" | "chart", choice: string) => void;
  onLeave: () => void;
}) {
  const kind = voyage.myDuty ? "duty" : "chart";
  const options = voyage.myDuty?.options ?? voyage.chart?.islands ?? [];
  const clues = voyage.duties.flatMap((duty) => (duty.clue ? [duty.clue] : []));

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-none text-gilded">{STEP[voyage.phase]}</h1>
        <p className="mt-3 max-w-2xl font-body text-base italic text-parchment/75 sm:text-lg">{voyage.briefing}</p>

        <ParchmentCard className="mt-6" eyebrow="Your orders" title={voyage.myDuty?.title}>
          <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.28em] text-blood">Do this now</p>
          <p className="mt-2 font-body text-xl leading-snug text-ink sm:text-2xl">{voyage.yourOrders}</p>

          {voyage.chart && (
            <p className="mt-4 text-center font-display text-3xl text-ink">{clues.join(" · ")}</p>
          )}

          {options.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <Button
                  key={option.id}
                  variant="parchment"
                  size="lg"
                  fullWidth
                  disabled={pending}
                  className="h-auto min-h-12 whitespace-normal py-3"
                  onClick={() => onAct(kind, option.id)}
                >
                  {"label" in option ? option.label : option.name}
                </Button>
              ))}
            </div>
          )}

          {voyage.chart && (
            <p className="mt-3 text-center font-ui text-[0.62rem] uppercase tracking-[0.22em] text-ink-soft">
              Wrong islands {voyage.strikes} of {voyage.maxStrikes}
            </p>
          )}

          {voyage.hoard && <p className="mt-5 text-center font-display text-3xl text-ink">{voyage.hoard}</p>}

          {feedback && (
            <p role="status" className={cn("mt-4 text-center font-body text-lg italic", feedback.ok ? "text-kelp" : "text-blood")}>
              {feedback.text}
            </p>
          )}
        </ParchmentCard>
      </section>

      <Panel eyebrow="Shared with the crew" title="Watch list" className="lg:sticky lg:top-4">
        <ol className="space-y-3">
          {voyage.duties.map((duty) => (
            <li key={duty.playerId} className="border-b border-brass/15 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-2xl text-parchment">{duty.playerName}</p>
                <Badge tone={duty.done ? "kelp" : "fog"}>{duty.done ? "Kept" : "On watch"}</Badge>
              </div>
              <p className="font-body text-sm italic text-parchment/60">{duty.title}</p>
              {duty.clue && <p className="mt-1 font-body text-base text-gold">Clue: {duty.clue}</p>}
            </li>
          ))}
        </ol>
        <Button variant="ghost" className="mt-5" fullWidth icon={<DoorIcon size={14} />} onClick={onLeave} loading={leaving}>
          Return to the harbour
        </Button>
      </Panel>
    </div>
  );
}
