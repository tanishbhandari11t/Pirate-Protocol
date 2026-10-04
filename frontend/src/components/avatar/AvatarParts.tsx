import type { AvatarLook } from "@/lib/avatars";

/*
 * Outfit pieces drawn over the base portrait. Every part shares PirateAvatar's 120×120 canvas:
 * the face is centred at (60, 56), the eyes sit at (51, 56) and (69, 56), the mouth near y 73.
 */

export function PlumedHat({ color, trim }: { color: string; trim: string }) {
  return (
    <g>
      <path d="M20 40 C30 30 44 26 60 26 C76 26 90 30 100 40 C90 44 76 44 60 46 C44 44 30 44 20 40 Z" fill={color} />
      <path d="M38 40 C38 22 48 13 60 13 C72 13 82 22 82 40 Z" fill={color} />
      <path d="M38 34 C50 31 70 31 82 34 L82 39 C70 36 50 36 38 39 Z" fill={trim} />
      <path d="M20 40 C30 44 44 44 60 46 C76 44 90 44 100 40" stroke={trim} strokeWidth="1.6" fill="none" opacity="0.8" />
      <g>
        <path d="M76 30 C86 10 102 0 118 -2 C108 6 98 18 84 32 Z" fill="#f5e8c6" />
        <path d="M78 30 C92 14 104 6 116 1" stroke="#c9a86b" strokeWidth="1" fill="none" />
        <path d="M84 24 l6 -1 M90 18 l6 -2 M96 12 l6 -2 M102 7 l5 -1.5" stroke="#c9a86b" strokeWidth="0.8" />
        <path d="M72 32 C80 18 92 12 104 10 C96 18 88 26 78 34 Z" fill="#c2392f" opacity="0.9" />
      </g>
      <circle cx="78" cy="34" r="3.2" fill={trim} stroke="#6f4f1c" strokeWidth="0.8" />
    </g>
  );
}

export function SkullCap({ color }: { color: string }) {
  return (
    <g>
      <path d="M36 50 C34 28 46 20 60 20 C74 20 86 28 84 50 C76 41 68 37 60 37 C52 37 44 41 36 50 Z" fill={color} />
      <path d="M84 44 L98 52 L92 58 Z M84 46 L94 62 L87 64 Z" fill={color} />
      <path d="M36 50 C44 41 52 37 60 37 C68 37 76 41 84 50" stroke="#0d0906" strokeWidth="1.2" fill="none" opacity="0.6" />
      <g transform="translate(60 29)" fill="#efe3c5">
        <path d="M-5.5 -1 C-5.5 -5.5 5.5 -5.5 5.5 -1 C5.5 2 3.5 3 3.5 4.5 L-3.5 4.5 C-3.5 3 -5.5 2 -5.5 -1 Z" />
        <circle cx="-2.2" cy="-1" r="1.5" fill={color} />
        <circle cx="2.2" cy="-1" r="1.5" fill={color} />
        <path d="M-2 4.5 v1.6 M0 4.5 v1.6 M2 4.5 v1.6" stroke={color} strokeWidth="0.7" />
        <path d="M-8 6 L8 10 M8 6 L-8 10" stroke="#efe3c5" strokeWidth="1.4" />
      </g>
    </g>
  );
}

export function Crown() {
  return (
    <g>
      <path
        d="M38 40 L36 20 L46 30 L53 14 L60 28 L67 14 L74 30 L84 20 L82 40 Z"
        fill="#e0b23c"
        stroke="#7a5414"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="37" y="36" width="46" height="8" rx="2" fill="#c8961f" stroke="#7a5414" strokeWidth="1.2" />
      <path d="M40 38 H80" stroke="#fff1b8" strokeWidth="0.9" opacity="0.7" />
      <circle cx="60" cy="40" r="2.6" fill="#c2392f" stroke="#6e1712" strokeWidth="0.6" />
      <circle cx="48" cy="40" r="1.8" fill="#2f6fa8" />
      <circle cx="72" cy="40" r="1.8" fill="#2f6fa8" />
      {[
        [36, 20],
        [53, 14],
        [67, 14],
        [84, 20],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.2" fill="#fff1b8" stroke="#7a5414" strokeWidth="0.6" />
      ))}
      <path d="M46 30 L50 36 M74 30 L70 36" stroke="#fff1b8" strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

export function Monocle() {
  return (
    <g>
      <circle cx="69" cy="56" r="7" fill="#cfe7ee" fillOpacity="0.18" stroke="#c89b45" strokeWidth="1.8" />
      <path d="M64.5 52 A6 6 0 0 1 72 50.5" stroke="#fff" strokeWidth="1" strokeOpacity="0.6" fill="none" />
      <path d="M75.5 59 C80 66 80 76 76 86" stroke="#c89b45" strokeWidth="0.9" fill="none" strokeDasharray="1.5 1.2" />
    </g>
  );
}

export function GoldTooth() {
  return <rect x="61.2" y="73.2" width="2.6" height="2.4" rx="0.6" fill="#ffd873" stroke="#7a5414" strokeWidth="0.4" />;
}

export function Hoops({ look }: { look: AvatarLook }) {
  return (
    <g fill="none" stroke="#f1d68d" strokeWidth="1.6">
      <circle cx="82" cy="67" r="3.4" />
      <circle cx="38" cy="67" r="3.4" />
      <circle cx="82" cy="70.4" r="0.8" fill={look.coatTrim} stroke="none" />
    </g>
  );
}

export function Pipe() {
  return (
    <g>
      <path d="M64 75 Q74 78 84 76" stroke="#3a2412" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M82 70 h8 v6 q-4 4 -8 0 Z" fill="#7a4a24" stroke="#3a2412" strokeWidth="1" />
      <ellipse cx="86" cy="70" rx="4" ry="1.4" fill="#1a1008" />
      <g fill="#d8d4cc" opacity="0.55" className="avatar-smoke">
        <circle cx="87" cy="64" r="2.2" />
        <circle cx="90" cy="58" r="2.8" />
        <circle cx="88" cy="51" r="3.4" />
      </g>
    </g>
  );
}

export function Medal() {
  return (
    <g>
      <path d="M68 92 L72 102 L76 92 Z" fill="#8e1f1a" />
      <path d="M72 92 L72 102" stroke="#e2b65a" strokeWidth="1" />
      <circle cx="72" cy="105" r="4.6" fill="#e0b23c" stroke="#7a5414" strokeWidth="1" />
      <path d="M72 102.2 l0.9 1.9 2.1 0.2 -1.6 1.4 0.5 2 -1.9 -1.1 -1.9 1.1 0.5 -2 -1.6 -1.4 2.1 -0.2 Z" fill="#fff1b8" />
    </g>
  );
}

export function Parrot() {
  return (
    <g className="avatar-parrot">
      <path d="M22 98 C16 86 18 72 28 68 C36 66 40 74 38 84 C37 92 32 98 26 102 Z" fill="#2f9a4a" stroke="#14532a" strokeWidth="1" />
      <path d="M24 96 C20 88 22 80 28 76 C30 84 30 92 26 100 Z" fill="#1d6fb0" />
      <path d="M26 100 C24 108 20 114 16 118 L22 118 C26 112 28 106 28 100 Z" fill="#c2392f" />
      <path d="M28 100 C28 108 26 114 24 120 L28 120 C30 112 30 106 30 100 Z" fill="#e7813c" />
      <circle cx="31" cy="72" r="6.2" fill="#3cb85a" stroke="#14532a" strokeWidth="0.9" />
      <path d="M36 70 C42 70 43 76 38 78 C38 75 37 73 35 73 Z" fill="#f1d68d" stroke="#6f4f1c" strokeWidth="0.7" />
      <circle cx="32" cy="70.6" r="1.6" fill="#fff" />
      <circle cx="32.4" cy="70.6" r="0.9" fill="#0d0906" />
      <path d="M26 66 C27 62 30 61 32 62" stroke="#ffd873" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Coat lapels re-tinted for a dressed coat, drawn over the base body. */
export function CoatShine({ trim }: { trim: string }) {
  return (
    <g stroke={trim} strokeWidth="1" fill="none" opacity="0.55">
      <path d="M22 116 C26 104 36 96 48 92" />
      <path d="M98 116 C94 104 84 96 72 92" />
    </g>
  );
}
