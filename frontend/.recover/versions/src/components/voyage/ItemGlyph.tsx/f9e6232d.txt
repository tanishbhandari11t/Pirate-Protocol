import type { SVGProps } from "react";
import type { ItemGlyph as Glyph } from "@/lib/game/world";

const PATHS: Record<Glyph, React.ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.5" strokeOpacity="0.5" />
      <path d="M12 5.5 14 12 12 18.5 10 12Z" fill="currentColor" fillOpacity="0.85" />
      <path d="M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22" />
    </>
  ),
  spyglass: (
    <>
      <path d="M3 17.5 15.5 6l3 3L6 20.5Z" />
      <path d="M13 8.3 16 11.3M9.5 11.5l3 3" strokeOpacity="0.6" />
      <path d="M17 3.5 21 7.5" strokeWidth="2.6" />
      <circle cx="4.2" cy="19.4" r="1.4" fill="currentColor" />
    </>
  ),
  key: (
    <>
      <circle cx="7" cy="8" r="4" />
      <circle cx="7" cy="8" r="1.4" fill="currentColor" />
      <path d="M10 10.5 19.5 20M15.5 16l2-2M17.5 18l2-2" />
      <path d="M3.5 4.5c1.5-2 5.5-2 7 0" strokeOpacity="0.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 5.5 9 3.5l6 2 5-2v15l-5 2-6-2-5 2Z" />
      <path d="M9 3.5v15M15 5.5v15" strokeOpacity="0.45" />
      <path d="M5.5 14c2-1 3-3 5.5-2.5s3 2.5 5.5 1" strokeDasharray="1.2 1.6" />
      <path d="m16.5 8.5 1.8 1.8M18.3 8.5l-1.8 1.8" />
    </>
  ),
  seal: (
    <>
      <path d="M12 2.5 14.2 4l2.6-.2 1 2.4 2.3 1.2-.4 2.6 1.3 2.2-1.6 2 .1 2.6-2.5.8-1.3 2.3-2.6-.5L12 21.5l-1.9-1.6-2.6.5-1.3-2.3-2.5-.8.1-2.6-1.6-2 1.3-2.2-.4-2.6 2.3-1.2 1-2.4 2.6.2Z" />
      <circle cx="12" cy="12" r="4.5" strokeOpacity="0.55" />
      <path d="M10 12.5 11.5 14l3-3.5" />
    </>
  ),
  rumor: (
    <>
      <path d="M6 3.5h11a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V5" />
      <path d="M4.5 5a1.5 1.5 0 1 1 3 0v12.5" />
      <path d="M10 8h6M10 11h6M10 14h4" strokeOpacity="0.6" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="6" strokeOpacity="0.45" />
      <path d="M12 8c-1.8 0-3 1.2-3 2.7 0 1.2.8 2 1.5 2.3v1.5h3V13c.7-.3 1.5-1.1 1.5-2.3C15 9.2 13.8 8 12 8Z" />
      <circle cx="11" cy="10.8" r=".6" fill="currentColor" />
      <circle cx="13" cy="10.8" r=".6" fill="currentColor" />
    </>
  ),
  chest: (
    <>
      <path d="M3.5 10h17v9.5h-17Z" />
      <path d="M3.5 10a8.5 5 0 0 1 17 0" />
      <path d="M3.5 13.5h17M8 10v9.5M16 10v9.5" strokeOpacity="0.5" />
      <rect x="10.5" y="12" width="3" height="3.5" rx="0.6" fill="currentColor" fillOpacity="0.8" />
    </>
  ),
};

export function ItemGlyph({ glyph, size = 24, ...props }: { glyph: Glyph; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[glyph]}
    </svg>
  );
}
