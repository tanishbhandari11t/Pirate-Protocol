import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Emblem } from "../brand/Logo";
import { ConnectionLantern } from "./ConnectionLantern";

export function TopBar({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-10 short:py-3",
        className,
      )}
    >
      <Link
        href="/"
        className="group flex min-w-0 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"
        aria-label="Pirate Protocol — back to the harbour"
      >
        <Emblem className="w-9 shrink-0 transition-transform duration-500 group-hover:rotate-[-8deg] sm:w-10" />
        <span className="hidden truncate font-display text-2xl leading-none text-gilded sm:inline">Pirate Protocol</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {children}
        <ConnectionLantern />
      </div>
    </header>
  );
}
