"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { useA11y } from "@/lib/a11y";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { SkipLink } from "./SkipLink";
import "./a11y.css";

/** Applies the player's accessibility preferences to the whole document and to every Framer animation. */
export function A11yRoot({ children }: { children: ReactNode }) {
  const settings = useA11y();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.contrast = settings.contrast;
    html.dataset.motion = settings.motion;
    html.dataset.calm = settings.calmEffects ? "on" : "off";
    html.style.setProperty("--pp-text-scale", String(settings.textScale));
  }, [settings]);

  return (
    <MotionConfig reducedMotion={settings.motion === "reduce" ? "always" : "user"}>
      <SkipLink />
      {children}
      <AccessibilityMenu />
    </MotionConfig>
  );
}
