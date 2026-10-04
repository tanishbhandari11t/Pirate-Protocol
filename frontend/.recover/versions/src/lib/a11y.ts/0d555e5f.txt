"use client";

import { useSyncExternalStore } from "react";

/**
 * Player accessibility preferences. Self-contained (its own tiny store) so it works on every page,
 * and stored on this device only.
 */

export type ContrastMode = "normal" | "high";
export type MotionMode = "system" | "reduce";
export type TextScale = 1 | 1.15 | 1.3;

export interface A11ySettings {
  contrast: ContrastMode;
  motion: MotionMode;
  textScale: TextScale;
  /** Mutes thunder flashes and screen shake, which can be hard on light-sensitive players. */
  calmEffects: boolean;
}

export const DEFAULT_A11Y: A11ySettings = { contrast: "normal", motion: "system", textScale: 1, calmEffects: false };
export const TEXT_SCALES: readonly TextScale[] = [1, 1.15, 1.3];

const KEY = "pp:a11y";

export function parseA11y(value: unknown): A11ySettings {
  if (!value || typeof value !== "object") return DEFAULT_A11Y;
  const v = value as Partial<Record<keyof A11ySettings, unknown>>;
  return {
    contrast: v.contrast === "high" ? "high" : "normal",
    motion: v.motion === "reduce" ? "reduce" : "system",
    textScale: TEXT_SCALES.includes(v.textScale as TextScale) ? (v.textScale as TextScale) : 1,
    calmEffects: v.calmEffects === true,
  };
}

const listeners = new Set<() => void>();
let cached: { raw: string | null; value: A11ySettings } | null = null;

function read(): A11ySettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* storage blocked: defaults */
  }
  if (cached && cached.raw === raw) return cached.value;
  let value = DEFAULT_A11Y;
  try {
    value = raw ? parseA11y(JSON.parse(raw)) : DEFAULT_A11Y;
  } catch {
    value = DEFAULT_A11Y;
  }
  cached = { raw, value };
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const a11yStore = {
  get: read,
  set(next: Partial<A11ySettings>) {
    const value = parseA11y({ ...read(), ...next });
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      cached = { raw: null, value };
    }
    listeners.forEach((l) => l());
  },
  reset() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing stored */
    }
    cached = null;
    listeners.forEach((l) => l());
  },
};

export function useA11y(): A11ySettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_A11Y);
}

/** True when motion should be cut: either the player chose it here or the OS asks for it. */
export function prefersReducedMotion(settings: A11ySettings = read()) {
  if (settings.motion === "reduce") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
