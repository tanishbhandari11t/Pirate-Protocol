import { cn } from "@/lib/cn";
import { TORN_EDGES } from "@/lib/tornEdge";

interface ParchmentBackdropProps {
  torn?: boolean;
  /** Picks one of the pre-generated tear patterns so neighbouring cards don't match. */
  variant?: number;
  className?: string;
}

/** Background layer of a parchment surface: texture, torn edge and a soft drop shadow. */
export function ParchmentBackdrop({ torn = true, variant = 0, className }: ParchmentBackdropProps) {
  return (
    <div aria-hidden className={cn("absolute inset-0 drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]", className)}>
      <div
        className="parchment absolute inset-0 rounded-[3px]"
        style={torn ? { clipPath: TORN_EDGES[variant % TORN_EDGES.length] } : undefined}
      />
    </div>
  );
}
