import { useId } from "react";
import { cn } from "@/lib/cn";
import type { ItemGlyph, Rarity } from "@/lib/game/world";

/*
 * Full-colour illustrations for the treasure chest, drawn on a 64×64 canvas. `ItemGlyph` stays
 * the small line icon for logs and badges; these are for berths, the compare panel and gear slots.
 */

const INK = "#2b1b0d";

const GLOW: Record<Rarity, string> = {
  common: "#9cc4cc",
  cursed: "#c2392f",
  relic: "#ffd873",
  legendary: "#fff1b8",
};

interface ItemArtProps {
  glyph: ItemGlyph;
  rarity?: Rarity;
  className?: string;
  title?: string;
  /** Halo behind the item; off for tiny sizes. */
  halo?: boolean;
}

export function ItemArt({ glyph, rarity = "common", className, title, halo = true }: ItemArtProps) {
  const uid = useId().replace(/:/g, "");
  const Art = ART[glyph];
  return (
    <svg viewBox="0 0 64 64" className={cn("block", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor={GLOW[rarity]} stopOpacity={rarity === "common" ? 0.25 : 0.45} />
          <stop offset="100%" stopColor={GLOW[rarity]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-brass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1c1" />
          <stop offset="35%" stopColor="#e2b65a" />
          <stop offset="75%" stopColor="#a87a2c" />
          <stop offset="100%" stopColor="#6f4f1c" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6c8" />
          <stop offset="45%" stopColor="#ffd873" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a2b" />
          <stop offset="100%" stopColor="#4a2c14" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5e8c6" />
          <stop offset="100%" stopColor="#c9a86b" />
        </linearGradient>
      </defs>
      {halo && <circle cx="32" cy="32" r="31" fill={`url(#${uid}-halo)`} />}
      <Art uid={uid} />
    </svg>
  );
}

type ArtProps = { uid: string };

const ART: Record<ItemGlyph, (p: ArtProps) => React.ReactElement> = {
  compass: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="55" rx="16" ry="3" fill="#000" opacity="0.25" />
      <circle cx="32" cy="32" r="21" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.5" />
      <circle cx="32" cy="32" r="16.5" fill="#f5e8c6" stroke="#6f4f1c" strokeWidth="1.2" />
      <circle cx="32" cy="9.5" r="3.2" fill="none" stroke={`url(#${uid}-brass)`} strokeWidth="2.4" />
      {Array.from({ length: 16 }, (_, i) => (
        <path
          key={i}
          d={`M32 ${i % 4 === 0 ? 16.5 : 17} V${i % 4 === 0 ? 19.5 : 18.5}`}
          transform={`rotate(${i * 22.5} 32 32)`}
          stroke={INK}
          strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
        />
      ))}
      <text x="32" y="23.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#8e1f1a" style={{ fontFamily: "var(--font-cinzel)" }}>
        N
      </text>
      <g transform="rotate(28 32 32)">
        <path d="M32 19 L35 32 L32 34 L29 32 Z" fill="#8e1f1a" stroke={INK} strokeWidth="0.6" />
        <path d="M32 45 L35 32 L32 30 L29 32 Z" fill="#2b3a44" stroke={INK} strokeWidth="0.6" />
      </g>
      <circle cx="32" cy="32" r="2" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="0.6" />
      <path d="M19 22 A16 16 0 0 1 30 16.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" fill="none" />
    </g>
  ),
  spyglass: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity="0.25" />
      <g transform="rotate(-35 32 32)">
        <rect x="6" y="26" width="16" height="12" rx="1.5" fill={`url(#${uid}-wood)`} stroke={INK} strokeWidth="1.2" />
        <rect x="20" y="24.5" width="16" height="15" rx="1.5" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.2" />
        <rect x="34" y="23" width="18" height="18" rx="2" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.2" />
        <rect x="50" y="22" width="6" height="20" rx="2" fill="#6f4f1c" stroke={INK} strokeWidth="1.2" />
        <ellipse cx="56" cy="32" rx="1.6" ry="8" fill="#9cc4cc" stroke={INK} strokeWidth="0.8" />
        <path d="M22 27 H34 M36 25.5 H50" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
        <path d="M10 26 v12 M15 26 v12" stroke="#2a180a" strokeOpacity="0.5" strokeWidth="0.8" />
        <ellipse cx="6" cy="32" rx="1.2" ry="5" fill="#2a180a" />
      </g>
    </g>
  ),
  key: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="18" ry="3" fill="#000" opacity="0.25" />
      <g transform="rotate(-40 32 32)">
        <path d="M14 32 C14 24 22 20 26 25 C28 20 34 22 33 28 L33 36 C34 42 28 44 26 39 C22 44 14 40 14 32 Z" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.3" />
        <circle cx="22" cy="32" r="3.4" fill="#2a180a" />
        <circle cx="21.2" cy="31.2" r="1" fill="#c2392f" />
        <path d="M33 30 H54 V34 H33 Z" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.2" />
        <path d="M47 34 v6 h3 v-3 h2 v5 h3 V34" fill={`url(#${uid}-brass)`} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M54 30 L58 32 L54 34" fill="#6f4f1c" stroke={INK} strokeWidth="1" />
        <path d="M35 31 H52" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" />
        <path d="M36 34 q2 2 4 0 q2 2 4 0" stroke={INK} strokeOpacity="0.5" strokeWidth="0.6" fill="none" />
      </g>
    </g>
  ),
  chart: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity="0.25" />
      <path d="M10 14 L23 10 L41 14 L54 10 V50 L41 54 L23 50 L10 54 Z" fill={`url(#${uid}-paper)`} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M23 10 V50 M41 14 V54" stroke={INK} strokeOpacity="0.3" strokeWidth="0.9" />
      <path d="M10 14 L23 10 V50 L10 54 Z" fill="#000" opacity="0.06" />
      <path d="M41 14 L54 10 V50 L41 54 Z" fill="#000" opacity="0.1" />
      <path d="M15 42 C20 36 24 40 28 33 S36 26 40 30 S46 24 49 20" stroke="#8e1f1a" strokeWidth="1.4" strokeDasharray="2 2.2" fill="none" />
      <path d="M46.5 17.5 l5 5 M51.5 17.5 l-5 5" stroke="#8e1f1a" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 22 q4 -3 8 0 M28 44 q4 -3 8 0" stroke={INK} strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
      <circle cx="17" cy="44" r="2" fill={INK} opacity="0.7" />
      <g transform="translate(34 20)" stroke={INK} strokeWidth="0.6" opacity="0.6">
        <path d="M0 -4 V4 M-4 0 H4" />
        <path d="M0 -4 l1 3 -1 1 -1 -1 Z" fill={INK} />
      </g>
    </g>
  ),
  seal: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="16" ry="3" fill="#000" opacity="0.25" />
      <path d="M24 46 L20 58 L26 55 L29 60 L32 48 Z" fill="#8e1f1a" stroke={INK} strokeWidth="1" />
      <path d="M40 46 L44 58 L38 55 L35 60 L32 48 Z" fill="#6e1712" stroke={INK} strokeWidth="1" />
      <path
        d="M32 9 l4 3 5 -0.5 2 4.6 4.4 2.3 -0.8 5 2.5 4.2 -3 3.9 0.2 5 -4.8 1.5 -2.5 4.4 -5 -1 -4 3.2 -3.6 -3 -5 1 -2.5 -4.4 -4.8 -1.5 0.2 -5 -3 -3.9 2.5 -4.2 -0.8 -5 4.4 -2.3 2 -4.6 5 0.5 Z"
        fill={`url(#${uid}-gold)`}
        stroke={INK}
        strokeWidth="1.2"
      />
      <circle cx="32" cy="30" r="12" fill="none" stroke="#8a6331" strokeWidth="1.2" />
      <circle cx="32" cy="30" r="9.5" fill="#e0b23c" stroke="#8a6331" strokeWidth="0.8" />
      <path d="M26 33 q6 -10 12 0 q-6 4 -12 0 Z" fill="#8a6331" />
      <path d="M28 33 v2 M30 33.5 v2 M32 34 v2 M34 33.5 v2 M36 33 v2" stroke="#fff6c8" strokeWidth="0.8" />
      <path d="M22 20 a14 14 0 0 1 10 -5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.4" fill="none" />
    </g>
  ),
  rumor: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="16" ry="3" fill="#000" opacity="0.25" />
      <path d="M17 13 H45 C48 13 49 15 49 17 V48 C49 51 47 53 44 53 H20 C17 53 15 51 15 48 V16" fill={`url(#${uid}-paper)`} stroke={INK} strokeWidth="1.3" />
      <path d="M15 16 C15 12 21 12 21 16 V46" fill="none" stroke={INK} strokeWidth="1.3" />
      <ellipse cx="18" cy="16" rx="3" ry="1.6" fill="#c9a86b" stroke={INK} strokeWidth="0.8" />
      {[22, 27, 32, 37].map((y, i) => (
        <path key={y} d={`M25 ${y} q${4} -1.5 ${i === 3 ? 10 : 18} 0`} stroke={INK} strokeOpacity="0.55" strokeWidth="1" fill="none" />
      ))}
      <path d="M38 41 c4 -1 7 2 5 5 c-1 2 -4 2 -5 1 l-3 2 1 -3 c-2 -2 -1 -4 2 -5 Z" fill="#9cc4cc" stroke={INK} strokeWidth="0.9" />
      <path d="M39 44 h3" stroke={INK} strokeWidth="0.8" />
    </g>
  ),
  coin: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="55" rx="16" ry="3" fill="#000" opacity="0.3" />
      <circle cx="32" cy="31" r="20" fill={`url(#${uid}-gold)`} stroke={INK} strokeWidth="1.4" />
      <circle cx="32" cy="31" r="16" fill="none" stroke="#8a6331" strokeWidth="1" strokeDasharray="1.2 1.6" />
      <path d="M32 19 C25 19 22.5 24 22.5 28 C22.5 32 25 34 26.5 35 V39 H37.5 V35 C39 34 41.5 32 41.5 28 C41.5 24 39 19 32 19 Z" fill="#5a3a1c" opacity="0.85" />
      <circle cx="28.3" cy="27.5" r="2.4" fill="#c2392f" />
      <circle cx="35.7" cy="27.5" r="2.4" fill="#c2392f" />
      <path d="M30 39 v-3 M32 39 v-3 M34 39 v-3" stroke="#ffd873" strokeWidth="0.8" />
      <path d="M16 18 q-3 -6 2 -9 M48 18 q3 -6 -2 -9" stroke="#c2392f" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
      <path d="M20 22 a13 13 0 0 1 8 -7" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.4" fill="none" />
    </g>
  ),
  chest: ({ uid }) => (
    <g>
      <ellipse cx="32" cy="56" rx="24" ry="3.5" fill="#000" opacity="0.3" />
      <path d="M8 30 H56 V52 H8 Z" fill={`url(#${uid}-wood)`} stroke={INK} strokeWidth="1.4" />
      <path d="M8 30 C8 14 56 14 56 30 Z" fill={`url(#${uid}-wood)`} stroke={INK} strokeWidth="1.4" />
      <path d="M8 36 H56 M8 46 H56" stroke="#2a180a" strokeOpacity="0.5" strokeWidth="0.8" />
      <path d="M14 30 V52 M50 30 V52 M14 30 C14 19 18 17 18 17 M50 30 C50 19 46 17 46 17" stroke={`url(#${uid}-gold)`} strokeWidth="3" fill="none" />
      <path d="M8 30 H56" stroke={`url(#${uid}-gold)`} strokeWidth="2.6" />
      <rect x="27" y="31" width="10" height="11" rx="1.5" fill={`url(#${uid}-gold)`} stroke={INK} strokeWidth="1" />
      <circle cx="32" cy="35.5" r="1.6" fill={INK} />
      <path d="M32 36.5 v3" stroke={INK} strokeWidth="1.2" />
      {[
        [20, 26],
        [38, 24],
        [44, 27],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l1.2 -3 1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 Z`} fill="#fff6c8" opacity="0.85" />
      ))}
    </g>
  ),
};
