"use client";

import { motion, useReducedMotionConfig } from "framer-motion";
import { cn } from "@/lib/cn";
import { destinationLabel, leagues, type Destination } from "@/lib/game/heading";

interface CompassDialProps {
  /** Degrees clockwise from north for the needle; `null` lets it wander. */
  bearing: number | null;
  className?: string;
  /** Spin the needle several times before it settles, for the reveal. */
  spins?: number;
  /** Seconds the needle takes to settle. */
  settle?: number;
  /** Storm magnetism: the needle spins wild instead of holding its heading. */
  storm?: boolean;
  /** Treasure close by: the rim breathes gold. */
  glow?: boolean;
  /** A curse aboard: the glass is cracked and tinged violet. */
  cursed?: boolean;
}

/** A brass compass face. The needle swings to `bearing` with a little overshoot, like a real card. */
export function CompassDial({ bearing, className, spins = 0, settle = 1.4, storm = false, glow = false, cursed = false }: CompassDialProps) {
  const reduced = useReducedMotionConfig();
  const target = bearing === null ? null : bearing + spins * 360;
  const wild = storm && !reduced;
  return (
    <svg viewBox="0 0 100 100" className={cn("block overflow-visible", className)} aria-hidden>
      {glow && (
        <motion.circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          stroke="#ffd873"
          strokeWidth="4"
          animate={reduced ? { opacity: 0.7 } : { opacity: [0.2, 0.95, 0.2], r: [48, 52, 48] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ filter: "drop-shadow(0 0 6px #ffd873)" }}
        />
      )}
      <defs>
        <radialGradient id="dial-face" cx="45%" cy="40%">
          <stop offset="0%" stopColor="#fbf2d8" />
          <stop offset="100%" stopColor="#d9c28e" />
        </radialGradient>
        <linearGradient id="dial-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1c1" />
          <stop offset="40%" stopColor="#c89b45" />
          <stop offset="100%" stopColor="#5a3d14" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#dial-rim)" stroke="#2b1b0d" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="40" fill="url(#dial-face)" stroke="#6f4f1c" strokeWidth="1.2" />
      {Array.from({ length: 32 }, (_, i) => (
        <path
          key={i}
          d={`M50 ${i % 8 === 0 ? 11 : i % 2 === 0 ? 12.5 : 13.5} V16`}
          transform={`rotate(${i * 11.25} 50 50)`}
          stroke="#2b1b0d"
          strokeWidth={i % 8 === 0 ? 1.6 : 0.7}
        />
      ))}
      {(["N", "E", "S", "W"] as const).map((p, i) => (
        <text
          key={p}
          x="50"
          y="25"
          transform={`rotate(${i * 90} 50 50)`}
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill={p === "N" ? "#8e1f1a" : "#2b1b0d"}
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          {p}
        </text>
      ))}
      <path d="M50 22 L54 50 L50 78 L46 50 Z" fill="#2b1b0d" opacity="0.08" />
      <motion.g
        style={{ transformOrigin: "50px 50px" }}
        initial={{ rotate: target === null ? 0 : spins ? 0 : target }}
        animate={
          wild
            ? { rotate: [0, 380, 200, 720, 540, 1080] }
            : target === null
              ? reduced
                ? { rotate: 0 }
                : { rotate: [0, 40, -25, 70, 10, 0] }
              : { rotate: target }
        }
        transition={
          wild
            ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
            : target === null
              ? { duration: 6, repeat: reduced ? 0 : Infinity, ease: "easeInOut" }
              : reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: spins ? 18 : 60, damping: spins ? 7 : 9, duration: settle }
        }
      >
        <path d="M50 18 L55 50 L50 54 L45 50 Z" fill="#8e1f1a" stroke="#2b1b0d" strokeWidth="0.8" />
        <path d="M50 82 L55 50 L50 46 L45 50 Z" fill="#26343d" stroke="#2b1b0d" strokeWidth="0.8" />
      </motion.g>
      <circle cx="50" cy="50" r="3.6" fill="url(#dial-rim)" stroke="#2b1b0d" strokeWidth="0.8" />
      <path d="M22 30 A34 34 0 0 1 44 13" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" fill="none" />
      {cursed && (
        <g>
          <circle cx="50" cy="50" r="40" fill="#5b2a86" opacity="0.18" />
          <motion.path
            d="M50 50 L36 30 L30 22 M36 30 L24 34 M50 50 L66 62 L74 60 M66 62 L70 76 M50 50 L58 32 L64 24"
            fill="none"
            stroke="#1b1208"
            strokeWidth="0.9"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <path d="M50 50 L36 30 L30 22 M50 50 L66 62" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.4" transform="translate(0.6 0.4)" />
        </g>
      )}
    </svg>
  );
}

interface HelmCompassProps {
  destination: Destination | null;
  className?: string;
  /** The sea is in a squall or tempest. */
  storm?: boolean;
  /** The sailor carries a cursed coin. */
  cursed?: boolean;
}

/** Leagues within which the compass starts to glow for the Vault. */
const GLOW_LEAGUES = 18;

/** The fitted compass's readout on the deck: where to sail next and how far. */
export function HelmCompass({ destination, className, storm = false, cursed = false }: HelmCompassProps) {
  const glow = destination?.reason === "vault" && destination.distance <= GLOW_LEAGUES;
  const caption = storm ? "The needle spins wild" : cursed ? "A cracked glass" : destination?.reason === "vault" ? "The Vault calls" : "Next heading";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-brass/40 bg-abyss/80 py-1.5 pl-1.5 pr-3 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-sm",
        className,
      )}
      role="status"
      aria-label={destination ? `Compass: ${destinationLabel(destination)}` : "Compass: no heading"}
    >
      <CompassDial bearing={destination?.bearing ?? null} className="h-12 w-12" storm={storm} glow={glow} cursed={cursed} />
      <div className="min-w-0">
        <p className={cn("font-ui text-[0.5rem] font-bold uppercase tracking-[0.25em]", cursed ? "text-[#b98be0]" : glow ? "text-gold" : "text-brass/70")}>
          {caption}
        </p>
        <p className="max-w-[12rem] truncate font-display text-base leading-tight text-parchment">
          {destination ? destinationLabel(destination) : "The needle wanders"}
        </p>
        {destination && destination.distance >= 1 && (
          <p className="font-ui text-[0.55rem] uppercase tracking-[0.2em] text-foam/80">{leagues(destination.distance)} leagues</p>
        )}
      </div>
    </div>
  );
}
