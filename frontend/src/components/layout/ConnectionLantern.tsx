"use client";

import { cn } from "@/lib/cn";
import type { ConnectionStatus } from "@/lib/socket/client";
import { useConnectionStatus } from "@/lib/socket/hooks";
import { LanternIcon } from "../icons";
import { Tooltip } from "../ui/Tooltip";

const COPY: Record<ConnectionStatus, { label: string; detail: string; tone: string; lit: boolean }> = {
  idle: { label: "Docked", detail: "Not yet connected to the harbour.", tone: "text-parchment/40", lit: false },
  connecting: { label: "Hailing", detail: "Signalling the harbour…", tone: "text-gold", lit: true },
  connected: { label: "Harbour in sight", detail: "Connected to the game server.", tone: "text-kelp-light", lit: true },
  reconnecting: { label: "Lost in fog", detail: "Connection dropped — trying to reach the harbour again.", tone: "text-ember", lit: true },
  offline: { label: "Adrift", detail: "The game server cannot be reached.", tone: "text-blood-light", lit: false },
};

export function ConnectionLantern({ className }: { className?: string }) {
  const status = useConnectionStatus();
  const copy = COPY[status];

  return (
    <Tooltip content={copy.detail} side="bottom" className={className}>
      <span
        tabIndex={0}
        className="flex items-center gap-2 rounded-full border border-brass/25 bg-abyss/70 px-3 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
        aria-label={`Connection: ${copy.label}`}
      >
        <LanternIcon size={16} className={cn(copy.tone, copy.lit && "animate-flicker")} />
        <span className={cn("hidden font-ui text-[0.6rem] font-bold uppercase tracking-[0.22em] sm:inline", copy.tone)}>
          {copy.label}
        </span>
      </span>
    </Tooltip>
  );
}
