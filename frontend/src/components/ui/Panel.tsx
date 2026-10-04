import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}

/** Dark lacquered-wood panel with brass corner fittings. */
export function Panel({ title, eyebrow, actions, padded = true, className, children, ...rest }: PanelProps) {
  return (
    <section className={cn("wood-panel relative rounded-md", className)} {...rest}>
      <CornerFittings />
      {(title || actions) && (
        <header className="flex items-end justify-between gap-4 border-b border-brass/20 px-5 pb-3 pt-4 sm:px-6 short:pb-2 short:pt-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="truncate font-ui text-[0.62rem] uppercase tracking-[0.3em] text-brass/80">{eyebrow}</p>
            )}
            {title && <h2 className="mt-1 font-display text-3xl text-gilded short:text-2xl">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn(padded && "p-5 sm:p-6 short:p-4")}>{children}</div>
    </section>
  );
}

export function CornerFittings({ className }: { className?: string }) {
  const corner = "absolute h-6 w-6 text-brass";
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <Corner className={cn(corner, "left-0 top-0")} />
      <Corner className={cn(corner, "right-0 top-0 rotate-90")} />
      <Corner className={cn(corner, "bottom-0 right-0 rotate-180")} />
      <Corner className={cn(corner, "bottom-0 left-0 -rotate-90")} />
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M1 1h14l-3 3H4v8l-3 3V1Z" fill="currentColor" opacity="0.9" />
      <path d="M1 1h14l-3 3H4v8l-3 3V1Z" fill="none" stroke="#fff1c1" strokeOpacity="0.4" strokeWidth="0.6" />
      <circle cx="4.5" cy="4.5" r="1.3" fill="#fff1c1" opacity="0.7" />
    </svg>
  );
}
