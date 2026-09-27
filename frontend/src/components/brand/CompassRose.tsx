import { cn } from "@/lib/cn";

interface CompassRoseProps {
  className?: string;
  /** Stroke/fill colour of the rose. */
  tone?: "brass" | "ink";
}

export function CompassRose({ className, tone = "brass" }: CompassRoseProps) {
  const main = tone === "brass" ? "#c89b45" : "#2b1b0d";
  const light = tone === "brass" ? "#f1d68d" : "#57391d";
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <svg viewBox="-100 -100 200 200" className={cn("block", className)} aria-hidden>
      <circle r="96" fill="none" stroke={main} strokeWidth="0.8" opacity="0.7" />
      <circle r="90" fill="none" stroke={main} strokeWidth="0.4" opacity="0.6" />
      <circle r="62" fill="none" stroke={main} strokeWidth="0.5" strokeDasharray="1 3" opacity="0.8" />
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="0"
          y1={deg % 45 === 0 ? -80 : deg % 15 === 0 ? -84 : -87}
          x2="0"
          y2="-90"
          stroke={main}
          strokeWidth={deg % 45 === 0 ? 1.2 : 0.5}
          transform={`rotate(${deg})`}
          opacity="0.8"
        />
      ))}
      {[45, 135, 225, 315].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path d="M0 -58 L7 0 L0 0 Z" fill={main} opacity="0.55" />
          <path d="M0 -58 L-7 0 L0 0 Z" fill={light} opacity="0.35" />
        </g>
      ))}
      {[0, 90, 180, 270].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path d="M0 -78 L11 0 L0 0 Z" fill={main} />
          <path d="M0 -78 L-11 0 L0 0 Z" fill={light} />
        </g>
      ))}
      <circle r="7" fill={main} />
      <circle r="3" fill={light} />
      {(
        [
          ["N", 0, -93],
          ["E", 93, 0],
          ["S", 0, 93],
          ["W", -93, 0],
        ] as const
      ).map(([label, x, y]) => (
        <text
          key={label}
          x={x}
          y={y}
          fill={light}
          fontSize="11"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
