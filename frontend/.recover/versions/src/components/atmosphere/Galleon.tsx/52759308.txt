import { cn } from "@/lib/cn";

/** Silhouetted galleon riding the swell, with a flickering stern lantern. */
export function Galleon({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none animate-bob", className)} aria-hidden>
      <svg viewBox="0 0 220 180" className="h-full w-full">
        <defs>
          <linearGradient id="galleon-hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1a24" />
            <stop offset="100%" stopColor="#02070b" />
          </linearGradient>
        </defs>
        <g fill="#050d14">
          {/* masts */}
          <rect x="68" y="18" width="3" height="130" />
          <rect x="112" y="6" width="3.5" height="142" />
          <rect x="152" y="30" width="3" height="118" />
          {/* sails */}
          <path d="M44 34 Q70 44 96 34 L94 70 Q70 78 46 70 Z" opacity="0.92" />
          <path d="M48 76 Q70 86 92 76 L90 108 Q70 116 50 108 Z" opacity="0.92" />
          <path d="M86 20 Q114 32 142 20 L140 60 Q114 70 88 60 Z" opacity="0.92" />
          <path d="M90 66 Q114 78 138 66 L136 106 Q114 116 92 106 Z" opacity="0.92" />
          <path d="M132 44 Q154 52 176 44 L174 76 Q154 84 134 76 Z" opacity="0.92" />
          <path d="M136 82 Q154 90 172 82 L170 110 Q154 118 138 110 Z" opacity="0.92" />
          {/* bowsprit & rigging */}
          <path d="M22 128 L66 116" stroke="#050d14" strokeWidth="2.5" />
          <path d="M22 128 L69 20 M22 128 L113 8 M156 32 L204 120 M114 8 L154 32" stroke="#0a1822" strokeWidth="0.8" />
          {/* flag */}
          <path d="M115.5 6 L132 10 L126 14 L132 18 L115.5 18 Z" fill="#1a0707" />
        </g>
        {/* hull */}
        <path
          d="M28 126 L196 120 L204 110 L210 112 L200 142 Q150 160 110 160 Q66 160 44 148 Z"
          fill="url(#galleon-hull)"
        />
        <g fill="#e7813c" opacity="0.55">
          <rect x="70" y="136" width="4" height="3" />
          <rect x="94" y="137" width="4" height="3" />
          <rect x="118" y="137" width="4" height="3" />
          <rect x="142" y="136" width="4" height="3" />
          <rect x="166" y="134" width="4" height="3" />
        </g>
        <g className="animate-flicker">
          <circle cx="202" cy="106" r="3" fill="#ffc46b" />
          <circle cx="202" cy="106" r="10" fill="#ffb24d" opacity="0.18" />
        </g>
      </svg>
    </div>
  );
}
