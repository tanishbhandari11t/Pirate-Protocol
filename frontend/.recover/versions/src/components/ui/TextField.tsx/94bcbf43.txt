"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  icon?: ReactNode;
  showCount?: boolean;
}

/** Ink-on-parchment text input. Designed to sit on a ParchmentCard. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, icon, showCount, className, id, maxLength, value, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-msg`;
  const length = typeof value === "string" ? value.length : 0;

  return (
    <div className={cn("group", className)}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={inputId} className="font-ui text-[0.7rem] font-bold uppercase tracking-[0.28em] text-ink-soft">
          {label}
        </label>
        {showCount && maxLength && (
          <span className="font-ui text-[0.65rem] tabular-nums text-ink-soft/60">
            {length}/{maxLength}
          </span>
        )}
      </div>
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-[3px] border-b-2 bg-parchment-light/40 px-3 transition-colors",
          "shadow-[inset_0_2px_6px_rgba(90,55,20,0.18)]",
          error ? "border-blood" : "border-ink-soft/40 group-focus-within:border-ink",
        )}
      >
        {icon && <span className="text-ink-soft/70">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="h-12 w-full min-w-0 bg-transparent font-body text-xl text-ink placeholder:italic placeholder:text-ink-soft/45 focus:outline-none short:h-10 short:text-lg"
          {...rest}
        />
      </div>
      <p
        id={messageId}
        className={cn(
          "mt-1.5 min-h-5 font-body text-sm italic short:mt-1",
          error ? "text-blood" : "text-ink-soft/70",
        )}
      >
        {error ?? hint}
      </p>
    </div>
  );
});
