"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCrew } from "@/lib/crew/CrewProvider";
import { describeSettings } from "@/lib/crew/reducer";
import {
  STRIKE_LIMIT_MAX,
  STRIKE_LIMIT_MIN,
  TIME_LIMIT_OPTIONS,
  type TimeLimitMinutes,
  type VoyageSettings,
} from "@/lib/socket/contract";
import { describeError } from "@/lib/socket/errors";
import { ClockIcon, LightbulbIcon, LockIcon, MinusIcon, PlusIcon, SkullIcon, SlidersIcon, WarningIcon } from "../icons";
import { useNotify } from "../ui/Notifications";
import { Panel } from "../ui/Panel";

/** The captain's voyage settings. Everyone sees them; only the captain may change them, and only in harbour. */
export function ArticlesPanel() {
  const { state, isCaptain, configureVoyage, pending } = useCrew();
  const { notify } = useNotify();
  const [lastChanged, setLastChanged] = useState<keyof VoyageSettings | null>(null);
  const room = state.room;
  if (!room) return null;

  const settings = room.settings;
  const editable = isCaptain && room.phase === "lobby";
  const busy = pending.has("crew:configure");

  const change = async (patch: Partial<VoyageSettings>) => {
    if (!editable || busy) return;
    setLastChanged(Object.keys(patch)[0] as keyof VoyageSettings);
    const res = await configureVoyage(patch);
    if (!res.ok) {
      notify({ tone: "danger", title: "The articles would not change", message: describeError(res.error.code, res.error.message) });
    }
  };

  const spinning = (key: keyof VoyageSettings) => busy && lastChanged === key;

  return (
    <Panel
      eyebrow={editable ? "Signed by the captain" : "Read aloud by the captain"}
      title="Ship's Articles"
      actions={
        editable ? (
          <SlidersIcon size={18} className="text-brass/70" aria-hidden />
        ) : (
          <LockIcon size={16} className="text-brass/50" aria-label="Only the captain may change these" />
        )
      }
    >
      <div className="space-y-3.5">
        <Row icon={<SkullIcon size={15} />} label="Strikes before the sea claims you" busy={spinning("maxStrikes")}>
          <div className="flex items-center gap-1.5">
            <StepButton
              label="Fewer strikes"
              disabled={!editable || busy || settings.maxStrikes <= STRIKE_LIMIT_MIN}
              onClick={() => change({ maxStrikes: settings.maxStrikes - 1 })}
            >
              <MinusIcon size={14} />
            </StepButton>
            <span className="flex min-w-[4.5rem] justify-center gap-0.5" aria-label={`${settings.maxStrikes} strikes`}>
              {Array.from({ length: STRIKE_LIMIT_MAX }, (_, i) => (
                <SkullIcon key={i} size={13} className={i < settings.maxStrikes ? "text-blood-light" : "text-parchment/15"} />
              ))}
            </span>
            <StepButton
              label="More strikes"
              disabled={!editable || busy || settings.maxStrikes >= STRIKE_LIMIT_MAX}
              onClick={() => change({ maxStrikes: settings.maxStrikes + 1 })}
            >
              <PlusIcon size={14} />
            </StepButton>
          </div>
        </Row>

        <Row icon={<WarningIcon size={15} />} label="Traps on treacherous islands" busy={spinning("trapsEnabled")}>
          <Toggle
            label="Traps"
            on={settings.trapsEnabled}
            onLabel="Armed"
            offLabel="Disarmed"
            disabled={!editable || busy}
            onChange={(trapsEnabled) => change({ trapsEnabled })}
          />
        </Row>

        <Row icon={<LightbulbIcon size={15} />} label="Hints for sale" busy={spinning("hintsEnabled")}>
          <Toggle
            label="Hints"
            on={settings.hintsEnabled}
            onLabel="Allowed"
            offLabel="Forbidden"
            disabled={!editable || busy}
            onChange={(hintsEnabled) => change({ hintsEnabled })}
          />
        </Row>

        <Row icon={<ClockIcon size={15} />} label="Voyage clock" busy={spinning("timeLimitMinutes")} stacked>
          <div role="radiogroup" aria-label="Voyage clock" className="flex flex-wrap gap-1.5">
            {TIME_LIMIT_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={settings.timeLimitMinutes === minutes}
                disabled={!editable || busy}
                onClick={() => change({ timeLimitMinutes: minutes as TimeLimitMinutes })}
                className={cn(
                  "rounded border px-2.5 py-1 font-ui text-[0.62rem] uppercase tracking-wider transition",
                  settings.timeLimitMinutes === minutes
                    ? "border-gold/70 bg-gold/15 text-gold"
                    : "border-brass/25 text-brass/70 enabled:hover:border-brass-light enabled:hover:text-brass-light",
                  !editable && settings.timeLimitMinutes !== minutes && "opacity-40",
                )}
              >
                {minutes ? `${minutes} min` : "None"}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <p className="mt-4 border-t border-brass/15 pt-3 font-body text-sm italic text-parchment/60">
        {describeSettings(settings)}
        {editable && <span className="block text-brass/60">Changing an article asks every sailor to ready up again.</span>}
      </p>
    </Panel>
  );
}

function Row({
  icon,
  label,
  busy,
  stacked = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  busy: boolean;
  stacked?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("gap-2", stacked ? "flex flex-col" : "flex items-center justify-between")}>
      <span className={cn("flex items-center gap-2 font-body text-parchment/80 transition-opacity", busy && "opacity-50")}>
        <span className="text-brass">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded border border-brass/30 text-brass-light transition enabled:hover:bg-brass/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  on,
  onLabel,
  offLabel,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="group flex items-center gap-2 disabled:cursor-not-allowed"
    >
      <span className={cn("font-ui text-[0.6rem] uppercase tracking-wider", on ? "text-kelp-light" : "text-parchment/40")}>
        {on ? onLabel : offLabel}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          on ? "border-kelp-light/60 bg-kelp/40" : "border-parchment/20 bg-abyss/60",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
            on ? "left-[1.1rem] bg-kelp-light" : "left-0.5 bg-parchment/40",
          )}
        />
      </span>
    </button>
  );
}
