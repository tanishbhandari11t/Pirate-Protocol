import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Brass porthole ring with bolts, framing an avatar or any round content. */
export function Porthole({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square rounded-full p-[7%]",
        "bg-[conic-gradient(from_210deg,#6f4f1c,#f1d68d,#c89b45,#6f4f1c,#e2b65a,#8d6524,#6f4f1c)]",
        "shadow-[0_8px_24px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,241,193,0.4)]",
        glow && "shadow-[0_0_0_2px_rgba(255,216,115,0.8),0_0_30px_rgba(255,216,115,0.45),0_8px_24px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[5%] w-[5%] rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff3cc,#6f4f1c)]"
          style={{ transform: `translate(-50%, -50%) rotate(${i * 45 + 22.5}deg) translateY(-930%)` }}
        />
      ))}
      <div className="relative h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.9)] ring-2 ring-[#3a2a10]">
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,transparent_35%,transparent_70%,rgba(0,0,0,0.3)_100%)]"
        />
      </div>
    </div>
  );
}
