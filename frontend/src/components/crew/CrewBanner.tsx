import { cn } from "@/lib/cn";

/** A tattered black flag flying the crew's name. */
export function CrewBanner({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("relative mx-auto flex w-full max-w-sm items-start", className)}>
      <div className="h-36 w-1.5 shrink-0 rounded-full bg-[linear-gradient(90deg,#4a2c14,#8a5a2b,#2a180a)] shadow-md short:h-28" />
      <div className="relative -ml-px mt-1 flex-1 origin-left animate-sway" style={{ animationDuration: "5s" }}>
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]" aria-hidden>
          <path
            d="M0 0 C60 8 120 -6 180 4 C220 10 260 2 300 6 L286 30 L300 52 L284 74 L298 104 C240 98 190 112 130 104 C80 98 40 110 0 104 Z"
            fill="#0b0806"
          />
          <path
            d="M0 0 C60 8 120 -6 180 4 C220 10 260 2 300 6 L286 30 L300 52 L284 74 L298 104 C240 98 190 112 130 104 C80 98 40 110 0 104 Z"
            fill="none"
            stroke="#c89b45"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </svg>
        <div className="relative flex h-28 flex-col items-center justify-center px-6 short:h-22">
          <span className="font-ui text-[0.55rem] uppercase tracking-[0.4em] text-brass/70">The crew of the</span>
          <span className="mt-1 line-clamp-2 break-words text-center font-display text-3xl leading-tight text-parchment-light">
            {name || "Unnamed Vessel"}
          </span>
        </div>
      </div>
    </div>
  );
}
