import { useId } from "react";
import { AVATARS, type AvatarLook } from "@/lib/avatars";
import type { AvatarId } from "@/lib/socket/contract";
import { cn } from "@/lib/cn";

interface PirateAvatarProps {
  avatarId: AvatarId;
  className?: string;
  /** Desaturates the portrait, e.g. for disconnected sailors. */
  faded?: boolean;
  title?: string;
}

export function PirateAvatar({ avatarId, className, faded, title }: PirateAvatarProps) {
  const uid = useId().replace(/:/g, "");
  const look = AVATARS[avatarId]?.look ?? AVATARS.captain.look;

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={title ?? AVATARS[avatarId]?.title ?? "Pirate"}
      className={cn("block", faded && "grayscale opacity-60", className)}
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={look.backdrop[0]} />
          <stop offset="100%" stopColor={look.backdrop[1]} />
        </radialGradient>
        <radialGradient id={`face-${uid}`} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor={look.skin} />
          <stop offset="100%" stopColor={look.skinShade} />
        </radialGradient>
        <clipPath id={`clip-${uid}`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect width="120" height="120" fill={`url(#bg-${uid})`} />
        <circle cx="60" cy="40" r="46" fill="#fff" opacity="0.04" />
        <HairBack look={look} />
        <Body look={look} />
        <Head look={look} faceFill={`url(#face-${uid})`} />
        <Hat look={look} />
      </g>
    </svg>
  );
}

function Body({ look }: { look: AvatarLook }) {
  return (
    <g>
      <rect x="51" y="72" width="18" height="16" rx="4" fill={look.skinShade} />
      <path d="M10 124 C14 96 36 86 60 86 C84 86 106 96 110 124 Z" fill={look.coat} />
      <path d="M48 87 L60 106 L72 87 Z" fill="#eadcbc" />
      <path d="M48 87 L60 106 L52 110 L40 90 Z" fill={look.coat} opacity="0.9" />
      <path d="M72 87 L60 106 L68 110 L80 90 Z" fill={look.coat} opacity="0.9" />
      <path
        d="M40 90 L52 110 M80 90 L68 110"
        stroke={look.coatTrim}
        strokeWidth="1.6"
        fill="none"
      />
      <circle cx="44" cy="104" r="1.8" fill={look.coatTrim} />
      <circle cx="76" cy="104" r="1.8" fill={look.coatTrim} />
      <circle cx="46" cy="114" r="1.8" fill={look.coatTrim} />
      <circle cx="74" cy="114" r="1.8" fill={look.coatTrim} />
    </g>
  );
}

function HairBack({ look }: { look: AvatarLook }) {
  if (look.hair === "long") {
    return (
      <path
        d="M34 48 C28 78 32 98 42 104 L78 104 C88 98 92 78 86 48 Z"
        fill={look.hairColor}
      />
    );
  }
  if (look.hair === "braids") {
    return (
      <g fill={look.hairColor}>
        <path d="M35 50 C30 70 32 86 38 96 L46 94 C42 80 42 66 44 52 Z" />
        <path d="M85 50 C90 70 88 86 82 96 L74 94 C78 80 78 66 76 52 Z" />
        <circle cx="40" cy="98" r="3.5" />
        <circle cx="80" cy="98" r="3.5" />
      </g>
    );
  }
  return null;
}

function Head({ look, faceFill }: { look: AvatarLook; faceFill: string }) {
  const eye = look.eyeColor ?? "#1a1008";
  return (