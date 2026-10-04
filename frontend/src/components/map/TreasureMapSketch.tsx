"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/cn";

const INK = "#3a2412";

const ISLANDS = [
  "M118 152 C126 128 150 124 164 110 C180 96 204 108 222 104 C246 100 262 118 258 134 C255 148 284 150 288 172 C292 194 272 200 276 216 C280 234 250 246 226 238 C206 232 196 250 172 246 C150 242 146 226 132 222 C112 216 100 196 110 180 C118 168 112 162 118 152 Z",
  "M466 96 C476 78 500 84 514 74 C530 64 556 72 566 88 C574 100 596 100 598 120 C600 138 584 146 590 162 C596 180 572 196 552 190 C534 186 522 200 502 194 C482 188 484 170 468 164 C452 158 448 138 458 126 C466 116 458 108 466 96 Z",
  "M372 312 C380 290 408 296 422 282 C438 268 466 280 486 276 C510 272 530 290 528 306 C526 322 552 330 548 352 C544 374 520 372 516 390 C512 406 484 408 466 400 C448 392 432 408 410 400 C388 392 394 374 380 366 C362 356 354 336 364 326 C370 320 368 318 372 312 Z",
];

const ROUTE = "M90 360 C150 330 170 280 210 260 S330 250 350 210 S430 150 500 150 S580 240 520 300 S470 350 470 345";

/** Hand-inked SVG chart whose route draws itself in. */
export function TreasureMapSketch({ className }: { className?: string }) {
  const maskId = `route-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 680 440" className={cn("block h-auto w-full", className)} role="img" aria-label="A hand-drawn treasure map">
      <g>
        {/* wave marks */}
        {Array.from({ length: 14 }, (_, i) => {
          const x = 40 + ((i * 97) % 600);
          const y = 40 + ((i * 131) % 360);
          return (
            <path
              key={i}
              d={`M${x} ${y} q6 -6 12 0 t12 0`}
              stroke={INK}
              strokeOpacity="0.35"
              strokeWidth="1.4"
              fill="none"
            />
          );
        })}

        {ISLANDS.map((d, i) => (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.3, duration: 1 }}>
            <path d={d} fill="#d8bd84" stroke={INK} strokeWidth="2.2" />
            <path d={d} fill="none" stroke={INK} strokeOpacity="0.3" strokeWidth="1" transform="translate(4 5)" />
          </motion.g>
        ))}

        {/* palms & peaks */}
        <g stroke={INK} strokeWidth="1.6" fill="none" opacity="0.8">
          <path d="M190 170 l12 -22 l12 22 M204 160 l8 -14 l8 14" />
          <path d="M520 120 v-18 M520 102 q-10 -2 -14 6 M520 102 q10 -2 14 6 M520 102 q-4 -10 -12 -10 M520 102 q4 -10 12 -10" />
          <path d="M430 330 l10 -18 l10 18 M445 330 l9 -15 l9 15" />
        </g>

        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="440">
          <motion.path
            d={ROUTE}
            stroke="#fff"
            strokeWidth="10"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.2, duration: 3.2, ease: "easeInOut" }}
          />
        </mask>
        <path
          d={ROUTE}
          stroke="#8e1f1a"
          strokeWidth="3.5"
          strokeDasharray="1 10"
          strokeLinecap="round"
          fill="none"
          mask={`url(#${maskId})`}
        />

        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 4.2, type: "spring", stiffness: 300, damping: 12 }}
          style={{ transformOrigin: "470px 345px" }}
        >
          <path d="M458 333 L482 357 M482 333 L458 357" stroke="#8e1f1a" strokeWidth="5" strokeLinecap="round" />
        </motion.g>

        {/* compass */}
        <g transform="translate(600 370)" stroke={INK} fill="none" strokeWidth="1.4">
          <circle r="34" />
          <circle r="28" strokeOpacity="0.5" />
          <path d="M0 -40 L6 0 L0 40 L-6 0 Z" fill={INK} fillOpacity="0.8" />
          <path d="M-40 0 L0 5 L40 0 L0 -5 Z" fill={INK} fillOpacity="0.4" />
          <text y="-46" textAnchor="middle" fill={INK} stroke="none" fontSize="14" style={{ fontFamily: "var(--font-pirata)" }}>
            N
          </text>
        </g>

        {/* sea serpent */}
        <path
          d="M260 380 q14 -24 28 0 q14 24 28 0 q14 -24 28 0 M340 380 q8 -8 16 -2 l-4 6"
          stroke={INK}
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
        <text x="72" y="60" fill={INK} fontSize="22" style={{ fontFamily: "var(--font-pirata)" }} opacity="0.85">
          Here be Treasure
        </text>
      </g>
    </svg>
  );
}
