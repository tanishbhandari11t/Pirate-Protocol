"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  hue: number;
}

interface ParticlesProps {
  className?: string;
  /** Motes per 10,000 px² of canvas. */
  density?: number;
}

/** Drifting gold dust and embers rendered on a canvas. */
export function Particles({ className, density = 0.45 }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let motes: Mote[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const spawn = (anywhere: boolean): Mote => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 10,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(0.08 + Math.random() * 0.35),
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.2 ? 20 : 42,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((width * height) / 10000) * density);
      motes = Array.from({ length: Math.min(count, 120) }, () => spawn(true));
    };

    const sprites = new Map<number, HTMLCanvasElement>();
    const sprite = (hue: number) => {
      const cached = sprites.get(hue);
      if (cached) return cached;
      const size = 32;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, `hsla(${hue}, 100%, 85%, 1)`);
      grad.addColorStop(0.25, `hsla(${hue}, 95%, 65%, 0.8)`);
      grad.addColorStop(1, `hsla(${hue}, 95%, 55%, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      sprites.set(hue, c);
      return c;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        m.x += m.vx + Math.sin(t / 2400 + m.phase) * 0.12;
        m.y += m.vy;
        if (m.y < -10) Object.assign(m, spawn(false));
        ctx.globalAlpha = Math.max(0.35 + Math.sin(t / 700 + m.phase) * 0.3, 0.05);
        const d = m.r * 6;
        ctx.drawImage(sprite(m.hue), m.x - d / 2, m.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
