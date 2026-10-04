"use client";

import { cn } from "@/lib/cn";
import { MARK_LIMITS, type MapMark } from "@/lib/socket/marks";
import type { MarkTool } from "./MapMarksLayer";

const TOOLS: { id: MarkTool | null; label: string; glyph: string; hint: string }[] = [
  { id: null, label: "Sail", glyph: "⎈", hint: "Select islands as usual" },
  { id: "pin", label: "Pin", glyph: "📍", hint: "Tap the chart to drop a pin" },
  { id: "danger", label: "Danger", glyph: "⚠", hint: "Warn the crew about a spot" },
  { id: "treasure", label: "Treasure?", glyph: "✕", hint: "Mark where you think the gold lies" },
  { id: "route", label: "Route", glyph: "〰", hint: "Drag to sketch a course" },
  { id: "erase", label: "Erase", glyph: "⌫", hint: "Tap one of your marks to wipe it" },
];

interface MarkToolbarProps {
  tool: MarkTool | null;
  onTool: (tool: MarkTool | null) => void;
  marks: MapMark[];
  meId: string;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

export function MarkToolbar({ tool, onTool, marks, meId, error, disabled, className }: MarkToolbarProps) {
  const mine = marks.filter((m) => m.playerId === meId).length;
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = TOOLS.findIndex((t) => t.id === tool);
    const next = TOOLS[(index + step + TOOLS.length) % TOOLS.length];
    onTool(next.id);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tool="${next.id ?? "none"}"]`)?.focus();
  };

  return (
    <div className={cn("parchment rounded-lg px-2 py-1.5", className)}>
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label="Chart ink" className="flex gap-1" onKeyDown={onKeyDown}>
          {TOOLS.map((t) => {
            const checked = t.id === tool;
            return (
              <button
                key={t.id ?? "none"}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t.label}
                title={t.hint}
                data-tool={t.id ?? "none"}
                tabIndex={checked ? 0 : -1}
                disabled={disabled && t.id !== null}
                onClick={() => onTool(t.id)}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-md border text-sm transition-colors",
                  checked ? "border-ink bg-ink text-parchment" : "border-ink/25 text-ink hover:bg-ink/10",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span aria-hidden>{t.glyph}</span>
              </button>
            );
          })}
        </div>
        <span className="font-display text-xs text-ink/70" aria-label={`${mine} of ${MARK_LIMITS.perSailor} marks used`}>
          {mine}/{MARK_LIMITS.perSailor}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-tight text-ink/70" aria-live="polite">
        {error ?? active.hint}
      </p>
    </div>
  );
}
