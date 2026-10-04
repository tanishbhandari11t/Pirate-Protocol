"use client";

import { useAnimate, useReducedMotionConfig } from "framer-motion";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useA11y } from "@/lib/a11y";

interface Jolt {
  id: number;
  power: number;
}

let jolt: Jolt = { id: 0, power: 0 };
const listeners = new Set<() => void>();

/** Rattles whatever is wrapped in <ShakeLayer>. `power` 1 is a thump, 2 a broadside, 3 the world ending. */
export function shake(power = 1) {
  jolt = { id: jolt.id + 1, power: Math.max(0.3, Math.min(3, power)) };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY: Jolt = { id: 0, power: 0 };

export function ShakeLayer({ children, className }: { children: ReactNode; className?: string }) {
  const current = useSyncExternalStore(
    subscribe,
    () => jolt,
    () => EMPTY,
  );
  const calm = useA11y().calmEffects;
  const still = useReducedMotionConfig() || calm;
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (current.id === 0 || still || !scope.current) return;
    const p = current.power * 7;
    const r = current.power * 0.3;
    const controls = animate(
      scope.current,
      {
        x: [0, -p, p * 0.8, -p * 0.6, p * 0.4, -p * 0.2, 0],
        y: [0, p * 0.5, -p * 0.4, p * 0.3, -p * 0.2, 0, 0],
        rotate: [0, -r, r * 0.8, -r * 0.5, 0, 0, 0],
      },
      { duration: 0.45 + current.power * 0.12, ease: "easeOut" },
    );
    return () => controls.stop();
  }, [current, still, animate, scope]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
