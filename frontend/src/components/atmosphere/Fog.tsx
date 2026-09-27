import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

const BANKS = [
  { top: "48%", left: "-10%", w: "70%", h: "38%", dur: 46, delay: -8, opacity: 0.55 },
  { top: "60%", left: "30%", w: "80%", h: "40%", dur: 60, delay: -30, opacity: 0.5 },
  { top: "35%", left: "10%", w: "60%", h: "30%", dur: 70, delay: -50, opacity: 0.3 },
  { top: "72%", left: "-20%", w: "90%", h: "35%", dur: 38, delay: -18, opacity: 0.6 },
  { top: "20%", left: "45%", w: "55%", h: "26%", dur: 80, delay: -12, opacity: 0.18 },
];

interface FogProps {
  className?: string;
  density?: number;
}

export function Fog({ className, density = 1 }: FogProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {BANKS.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(156,196,204,0.22)_0%,rgba(120,160,170,0.1)_40%,transparent_70%)]"
          style={
            {
              top: b.top,
              left: b.left,
              width: b.w,
              height: b.h,
              "--fog-opacity": b.opacity * density,
              animation: `fog-drift ${b.dur}s linear ${b.delay}s infinite alternate`,
            } as CSSProperties
          }
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-[rgba(120,160,170,0.12)] to-transparent" />
    </div>
  );
}
