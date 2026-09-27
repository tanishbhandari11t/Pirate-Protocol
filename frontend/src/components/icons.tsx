import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function SkullIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3c-4.4 0-7.5 3-7.5 7 0 2.4 1.2 4 2.5 5v2.5c0 .6.4 1 1 1h8c.6 0 1-.4 1-1V15c1.3-1 2.5-2.6 2.5-5 0-4-3.1-7-7.5-7Z" />
      <circle cx="9" cy="11" r="1.6" fill="currentColor" />
      <circle cx="15" cy="11" r="1.6" fill="currentColor" />
      <path d="M11 15.2 12 14l1 1.2M10 18.5v2M14 18.5v2" />
    </svg>
  );
}

export function AnchorIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M8 10h8M4.5 13.5C5 17.5 8.2 21 12 21s7-3.5 7.5-7.5M4.5 13.5 3 15M4.5 13.5 6.2 15M19.5 13.5 21 15M19.5 13.5 17.8 15" />
    </svg>
  );
}

export function CompassIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

export function ShipIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 16h18l-2.5 4h-13L3 16ZM12 3v13M12 4l6 8h-6M12 6l-5 6h5" />
    </svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />
    </svg>
  );
}

export function SwordsIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 4l10 10M4 4v3l9 9M4 4h3l9 9M20 4 10 14M20 4v3l-9 9M20 4h-3l-9 9M14 17l3 3M10 17l-3 3M16 14l2 2-2 2M8 14l-2 2 2 2" />
    </svg>
  );
}

export function CopyIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function LinkIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (