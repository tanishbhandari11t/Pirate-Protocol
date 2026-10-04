import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ParchmentBackdrop } from "./ParchmentBackdrop";

interface ParchmentCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** Roughen the edges like torn, sea-worn paper. */
  torn?: boolean;
  padded?: boolean;
}

/** Aged parchment surface with a torn edge; the texture sits on its own layer behind the content. */
export function ParchmentCard({
  title,
  eyebrow,
  torn = true,
  padded = true,
  className,
  children,
  ...rest
}: ParchmentCardProps) {
  return (
    <div className={cn("relative text-ink", className)} {...rest}>
      <ParchmentBackdrop torn={torn} />
      <div className={cn("relative", padded && "px-5 py-6 sm:px-8 sm:py-7 short:py-5 tiny:py-4")}>
        {(title || eyebrow) && (
          <header className="mb-6 text-center short:mb-3">
            {eyebrow && (
              <p className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.3em] text-ink-soft/80 sm:text-[0.65rem] sm:tracking-[0.4em]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="ink-bleed mt-1 font-display text-3xl text-ink sm:text-4xl short:text-3xl">{title}</h2>
            )}
            <InkFlourish className="mx-auto mt-2 w-48 text-ink-soft/70 short:mt-1" />
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

export function InkFlourish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 16" className={cn("block", className)} aria-hidden>
      <path
        d="M2 8 C40 8 60 2 90 8 M110 8 C140 14 160 8 198 8"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M100 2 L106 8 L100 14 L94 8 Z" fill="currentColor" />
      <circle cx="84" cy="8" r="1.5" fill="currentColor" />
      <circle cx="116" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}
