import type { CSSProperties } from "react";
import { seeded } from "@/lib/random";
import { cn } from "@/lib/cn";

const WIDTH = 2400;

function wavePath(baseline: number, amplitude: number, periods: number, height: number) {
  const wavelength = WIDTH / 2 / periods;
  let d = `M0 ${baseline}`;
  d += ` Q${wavelength / 4} ${baseline - amplitude} ${wavelength / 2} ${baseline}`;
  for (let x = wavelength / 2; x < WIDTH; x += wavelength / 2) {
    d += ` T${x + wavelength / 2} ${baseline}`;
  }
  return `${d} L${WIDTH} ${height} L0 ${height} Z`;
}

interface WaveLayer {
  top: string;
  height: number;
  amplitude: number;
  periods: number;
  fill: string;
  foam: number;
  duration: number;
  reverse?: boolean;
}

const LAYERS: WaveLayer[] = [
  { top: "0%", height: 120, amplitude: 5, periods: 9, fill: "#0e2a3b", foam: 0.18, duration: 70 },
  { top: "14%", height: 120, amplitude: 8, periods: 7, fill: "#0b2332", foam: 0.16, duration: 52, reverse: true },
  { top: "30%", height: 120, amplitude: 11, periods: 6, fill: "#091d2a", foam: 0.14, duration: 40 },
  { top: "50%", height: 120, amplitude: 14, periods: 5, fill: "#071722", foam: 0.12, duration: 30, reverse: true },
  { top: "70%", height: 120, amplitude: 18, periods: 4, fill: "#04101a", foam: 0.1, duration: 24 },
];

const rand = seeded(1717);
const GLINTS = Array.from({ length: 26 }, () => ({
  top: 4 + rand() * 80,
  offset: (rand() - 0.5) * 18,
  width: 12 + rand() * 60,
  delay: rand() * 4,
}));

export function Ocean({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden", className)}>
      {/* moonlight path */}
      <div className="absolute inset-y-0 left-[68%] w-[22%] -translate-x-1/2">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(241,214,141,0.22),transparent_70%)]" />
        {GLINTS.map((g, i) => (
          <span
            key={i}
            className="absolute h-[2px] rounded-full bg-brass-light/70 animate-twinkle"
            style={{
              top: `${g.top}%`,
              left: `calc(50% + ${g.offset}%)`,
              width: g.width,
              transform: "translateX(-50%)",
              animationDelay: `${g.delay}s`,
              opacity: 0.35,
            }}
          />
        ))}
      </div>

      {LAYERS.map((layer, i) => (
        <div key={i} className="absolute inset-x-0 bottom-0" style={{ top: layer.top }}>
          <div
            className="animate-wave absolute inset-y-0 left-0 w-[200%]"
            style={
              {
                "--wave-duration": `${layer.duration}s`,
                animationDirection: layer.reverse ? "reverse" : "normal",
              } as CSSProperties
            }
          >
            <svg
              viewBox={`0 0 ${WIDTH} ${layer.height}`}
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <path
                d={wavePath(layer.amplitude + 2, layer.amplitude, layer.periods, layer.height)}
                fill={layer.fill}
                stroke="#9cc4cc"
                strokeOpacity={layer.foam}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
