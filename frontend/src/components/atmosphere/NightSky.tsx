import type { CSSProperties } from "react";
import { seeded } from "@/lib/random";

const rand = seeded(42);
const STARS = Array.from({ length: 90 }, () => ({
  x: rand() * 100,
  y: rand() * 58,
  size: rand() < 0.12 ? 2.2 : rand() < 0.5 ? 1.4 : 1,
  delay: rand() * 5,
  duration: 3 + rand() * 4,
}));

export function NightSky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#010307_0%,#040b14_35%,#0a1f2d_62%,#123142_72%,#07131d_100%)]" />

      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-parchment-light animate-twinkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            boxShadow: s.size > 2 ? "0 0 6px rgba(255,240,200,0.9)" : undefined,
          }}
        />
      ))}

      {/* moon */}
      <div className="absolute left-[68%] top-[12%] -translate-x-1/2">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(241,214,141,0.18)_0%,rgba(241,214,141,0.05)_40%,transparent_70%)]" />
        <div className="relative h-20 w-20 rounded-full bg-[radial-gradient(circle_at_38%_35%,#fff7dc_0%,#f1d68d_45%,#b8893d_100%)] shadow-[0_0_60px_rgba(255,226,150,0.55)] md:h-24 md:w-24">
          <span className="absolute left-[22%] top-[48%] h-3 w-3 rounded-full bg-[#c9a15a]/50" />
          <span className="absolute left-[55%] top-[25%] h-4 w-4 rounded-full bg-[#c9a15a]/40" />
          <span className="absolute left-[60%] top-[62%] h-2 w-2 rounded-full bg-[#c9a15a]/50" />
        </div>
      </div>

      {/* drifting cloud bands */}
      <div className="absolute inset-x-0 top-[8%] h-40 opacity-60">
        <div
          className="animate-wave absolute inset-y-0 left-0 w-[200%]"
          style={{ "--wave-duration": "160s" } as CSSProperties}
        >
          <div className="h-full w-full bg-[radial-gradient(ellipse_18%_30%_at_12%_50%,rgba(20,54,72,0.7),transparent),radial-gradient(ellipse_14%_24%_at_38%_40%,rgba(20,54,72,0.55),transparent),radial-gradient(ellipse_20%_28%_at_62%_55%,rgba(20,54,72,0.7),transparent),radial-gradient(ellipse_14%_24%_at_88%_40%,rgba(20,54,72,0.55),transparent)]" />
        </div>
      </div>
    </div>
  );
}
