"use client";

import { motion } from "framer-motion";
import { useRef, type KeyboardEvent } from "react";
import { AVATAR_LIST, AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/cn";
import type { AvatarId } from "@/lib/socket/contract";
import { CheckIcon } from "../icons";
import { PirateAvatar } from "./PirateAvatar";

interface AvatarPickerProps {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  label?: string;
}

/** Radio group of pirate portraits with roving keyboard focus. */
export function AvatarPicker({ value, onChange, label = "Choose your likeness" }: AvatarPickerProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = AVATAR_LIST.findIndex((a) => a.id === value);
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = (index + delta + AVATAR_LIST.length) % AVATAR_LIST.length;
    onChange(AVATAR_LIST[next].id);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3 short:mb-2">
        <span id="avatar-picker-label" className="font-ui text-[0.7rem] font-bold uppercase tracking-[0.28em] text-ink-soft">
          {label}
        </span>
        <span className="font-body text-sm italic text-ink-soft/80">{AVATARS[value].title}</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="avatar-picker-label"
        className="grid grid-cols-4 gap-3 sm:grid-cols-8 sm:gap-2.5"
        onKeyDown={onKeyDown}
      >
        {AVATAR_LIST.map((avatar, i) => {
          const selected = avatar.id === value;
          return (
            <motion.button
              key={avatar.id}
              ref={(el) => {
                buttonsRef.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={avatar.title}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(avatar.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.94 }}
              className={cn(
                "relative aspect-square rounded-full p-[4px] transition-shadow focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-parchment",
                selected
                  ? "bg-[conic-gradient(from_200deg,#6f4f1c,#f1d68d,#c89b45,#6f4f1c,#e2b65a,#6f4f1c)] shadow-[0_0_18px_rgba(200,155,69,0.7)]"
                  : "bg-ink-soft/25 hover:bg-ink-soft/40",
              )}
            >
              <PirateAvatar
                avatarId={avatar.id}
                className={cn("h-full w-full rounded-full transition", !selected && "saturate-[0.7] sepia-[0.25]")}
              />
              {selected && (
                <motion.span
                  layoutId="avatar-check"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blood text-parchment-light shadow-md ring-2 ring-parchment"
                >
                  <CheckIcon size={11} strokeWidth={3} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
