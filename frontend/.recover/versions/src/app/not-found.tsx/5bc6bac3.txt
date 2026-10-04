import Link from "next/link";
import { Emblem } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Emblem className="w-24 opacity-80" />
      <p className="mt-6 font-ui text-xs uppercase tracking-[0.45em] text-brass/80">Uncharted waters</p>
      <h1 className="mt-2 font-display text-[clamp(2.75rem,10vw,3.75rem)] text-gilded">Nothing but Fog</h1>
      <p className="mt-4 max-w-md font-body text-lg italic text-parchment/70">
        No map marks this place. Many a sailor has drifted here — few return without turning back.
      </p>
      <Link
        href="/"
        className="brass-surface mt-8 inline-flex h-12 items-center rounded px-8 font-ui text-xs font-bold uppercase tracking-[0.25em] text-ink"
      >
        Return to harbour
      </Link>
    </main>
  );
}
