import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Brass rule with a compass-diamond centrepiece. */
export function Divider({ className, label }: { className?: string; label?: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 text-brass/70", className)} role="separator">
      <span className="h-px flex-1 bg-linear-to-r from-transparent via-brass/50 to-brass/70" />
      {label ? (
        <span className="font-ui text-[0.65rem] uppercase tracking-[0.35em]">{label}</span>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden>
          <path d="M10 0 L13 10 L10 20 L7 10 Z M0 10 L10 7 L20 10 L10 13 Z" fill="currentColor" />
        </svg>
      )}
      <span className="h-px flex-1 bg-linear-to-l from-transparent via-brass/50 to-brass/70" />
    </div>
  );
}

type SealTone = "blood" | "kelp" | "brass";

const SEAL_TONES: Record<SealTone, string> = {
  blood: "bg-[radial-gradient(circle_at_35%_30%,#d8544a,#8e1f1a_55%,#4d0f0b)] text-[#ffd9cf]",
  kelp: "bg-[radial-gradient(circle_at_35%_30%,#8fd3a6,#3e7a53_55%,#1d3d28)] text-[#e6ffe9]",
  brass: "bg-[radial-gradient(circle_at_35%_30%,#fff1c1,#c89b45_55%,#6f4f1c)] text-ink",
};

/** Wax seal stamp. */
export function Seal({
  children,
  tone = "blood",
  className,
}: {
  children: ReactNode;
  tone?: SealTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-12 w-12 items-center justify-center rounded-full",
        "shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_-2px_4px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.3)]",
        "font-ui text-[0.55rem] font-bold uppercase tracking-widest",
        SEAL_TONES[tone],
        className,
      )}
      style={{ clipPath: "polygon(50% 0,61% 4%,72% 2%,80% 10%,91% 13%,94% 25%,100% 35%,97% 47%,100% 58%,94% 69%,93% 81%,82% 86%,74% 96%,62% 95%,50% 100%,38% 95%,26% 96%,18% 86%,7% 81%,6% 69%,0 58%,3% 47%,0 35%,6% 25%,9% 13%,20% 10%,28% 2%,39% 4%)" }}
    >
      <span className="absolute inset-[18%] rounded-full border border-current opacity-40" />
      <span className="relative">{children}</span>
    </span>
  );
}

type BadgeTone = "brass" | "kelp" | "blood" | "fog";

const BADGE_TONES: Record<BadgeTone, string> = {
  brass: "border-brass/60 bg-brass/15 text-brass-light",
  kelp: "border-kelp-light/50 bg-kelp/20 text-kelp-light",
  blood: "border-blood-light/60 bg-blood/25 text-[#f2a097]",
  fog: "border-foam/30 bg-foam/10 text-foam",
};

export function Badge({
  children,
  tone = "brass",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-ui text-[0.6rem] font-bold uppercase tracking-[0.2em]",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
