"use client";

import { useEffect, useRef } from "react";

type Bindings = Record<string, () => void>;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Single-key shortcuts (keyed by lowercase `event.key`) that stay quiet while the player is typing. */
export function useHotkeys(bindings: Bindings, enabled = true) {
  const bindingsRef = useRef(bindings);

  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTyping(event.target)) return;
      const run = bindingsRef.current[event.key.toLowerCase()];
      if (!run) return;
      event.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
