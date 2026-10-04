"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ROOM_CODE_LENGTH } from "@/lib/socket/contract";
import { sanitizeRoomCode } from "@/lib/validation";

interface RoomCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
}

/** Six carved rune slots backed by a single real input (so paste and mobile keyboards just work). */
export function RoomCodeInput({ value, onChange, label = "Ship's code", error, autoFocus }: RoomCodeInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const slots = Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => value[i] ?? "");
  const caret = Math.min(value.length, ROOM_CODE_LENGTH - 1);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-ui text-[0.7rem] font-bold uppercase tracking-[0.28em] text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden>
          {slots.map((char, i) => {
            const active = focused && i === caret && value.length < ROOM_CODE_LENGTH + 1;
            return (
              <div
                key={i}
                className={cn(
                  "relative flex h-[clamp(3rem,8vh,4rem)] items-center justify-center rounded-[3px] border-2 bg-parchment-light/40",
                  "shadow-[inset_0_3px_8px_rgba(90,55,20,0.28)] transition-colors",
                  error ? "border-blood/70" : active ? "border-ink" : "border-ink-soft/30",
                )}
              >
                {char ? (
                  <motion.span
                    key={char + i}
                    initial={{ scale: 1.6, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    className="ink-bleed font-display text-3xl text-ink sm:text-4xl short:text-3xl"
                  >
                    {char}
                  </motion.span>
                ) : (
                  active && <span className="h-7 w-0.5 animate-pulse bg-ink" />
                )}
              </div>
            );
          })}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(sanitizeRoomCode(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={ROOM_CODE_LENGTH}
          aria-invalid={error ? true : undefined}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0"
        />
      </div>
      <p className={cn("mt-1.5 min-h-5 font-body text-sm italic", error ? "text-blood" : "text-ink-soft/70")}>
        {error ?? "Ask your captain for the six runes."}
      </p>
    </div>
  );
}
