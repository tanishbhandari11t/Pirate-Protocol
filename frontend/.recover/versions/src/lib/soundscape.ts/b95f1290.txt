"use client";

import { useEffect, useRef } from "react";
import { audioBus, noiseBuffer } from "./sound";

/**
 * The sea under the voyage, built from layers that follow the game: surf and wind rise with the
 * weather, timbers creak harder under sail, bells carry from port, gulls only fly by day, and a low
 * drone gathers when the water turns dangerous. Everything is synthesised; there are no samples.
 */

export interface SoundscapeMood {
  /** Weather intensity, 0 (glass-still) to 1 (gale). */
  intensity: number;
  /** The sailor's ship is under way. */
  sailing: boolean;
  /** Anchored at the starting harbour, where the bells are. */
  atPort: boolean;
  /** 0 by day, 1 at midnight. */
  darkness: number;
  /** 0 safe, 1 deadly. */
  danger: number;
}

export const CALM_MOOD: SoundscapeMood = { intensity: 0.1, sailing: false, atPort: true, darkness: 0, danger: 0 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Seconds until the next one-shot, shortened by `urgency` (0–1). */
const nextIn = (min: number, max: number, urgency = 0) => (min + Math.random() * (max - min)) * (1 - urgency * 0.6);

interface Layer {
  stop: (at: number) => void;
}

function loopNoise(c: AudioContext, out: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  src.connect(out);
  src.start(0, Math.random() * 1.5);
  return src;
}

function lfo(c: AudioContext, rate: number, depth: number, target: AudioParam) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = rate;
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start();
  return osc;
}

export interface Soundscape {
  update: (mood: SoundscapeMood) => void;
  stop: () => void;
}

export function startSoundscape(initial: SoundscapeMood = CALM_MOOD): Soundscape {
  const bus = audioBus();
  if (!bus) return { update: () => undefined, stop: () => undefined };
  const { c, out } = bus;
  let mood = initial;
  let stopped = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const layers: Layer[] = [];

  const bed = c.createGain();
  bed.gain.setValueAtTime(0.0001, c.currentTime);
  bed.gain.setTargetAtTime(1, c.currentTime, 1.5);
  bed.connect(out);

  /* Surf: brown noise through a lowpass that opens as the sea rises, with a slow swell. */
  const surfFilter = c.createBiquadFilter();
  surfFilter.type = "lowpass";
  const surfGain = c.createGain();
  const surfSwell = c.createGain();
  surfSwell.gain.value = 1;
  surfFilter.connect(surfGain).connect(surfSwell).connect(bed);
  const surf = loopNoise(c, surfFilter);
  const swell = lfo(c, 0.11, 0.45, surfSwell.gain);
  layers.push({ stop: (at) => (surf.stop(at), swell.stop(at)) });

  /* Wind: a resonant band that wanders in pitch and grows to a howl in a storm. */
  const windFilter = c.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.Q.value = 1.8;
  const windGain = c.createGain();
  windFilter.connect(windGain).connect(bed);
  const wind = loopNoise(c, windFilter);
  const gust = lfo(c, 0.17, 260, windFilter.frequency);
  layers.push({ stop: (at) => (wind.stop(at), gust.stop(at)) });

  /* Danger: a low, beating drone just at the edge of hearing. */
  const droneGain = c.createGain();
  droneGain.gain.value = 0.0001;
  droneGain.connect(bed);
  const droneA = c.createOscillator();
  const droneB = c.createOscillator();
  droneA.frequency.value = 55;
  droneB.frequency.value = 55.7;
  droneA.connect(droneGain);
  droneB.connect(droneGain);
  droneA.start();
  droneB.start();
  layers.push({ stop: (at) => (droneA.stop(at), droneB.stop(at)) });

  const apply = (smooth: number) => {
    const t = c.currentTime;
    const i = clamp01(mood.intensity);
    surfFilter.frequency.setTargetAtTime(320 + i * 1100 + (mood.sailing ? 250 : 0), t, smooth);
    surfGain.gain.setTargetAtTime(0.07 + i * 0.12 + (mood.sailing ? 0.03 : 0), t, smooth);
    windFilter.frequency.setTargetAtTime(480 + i * 620, t, smooth);
    windGain.gain.setTargetAtTime(0.008 + i * i * 0.17 + mood.darkness * 0.012, t, smooth);
    droneGain.gain.setTargetAtTime(Math.max(0.0001, clamp01(mood.danger) ** 1.5 * 0.07), t, smooth * 2);
  };
  apply(0.01);

  /* One-shots ------------------------------------------------------------------------------- */

  const schedule = (delaySec: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!stopped) fn();
    }, delaySec * 1000);
    timers.add(id);
  };

  const voice = (gain: number) => {
    const g = c.createGain();
    g.gain.value = gain;
    g.connect(bed);
    return g;
  };

  /** Hull timbers: a rubbed, pitch-bent saw through a narrow band, sometimes in pairs. */
  const creak = () => {
    const strain = clamp01(mood.intensity + (mood.sailing ? 0.35 : 0));
    const out = voice(0.035 + strain * 0.05);
    const count = Math.random() < 0.4 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const t = c.currentTime + k * (0.18 + Math.random() * 0.2);
      const dur = 0.25 + Math.random() * 0.45;
      const osc = c.createOscillator();
      const band = c.createBiquadFilter();
      const env = c.createGain();
      const base = 70 + Math.random() * 60;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * (1.15 + Math.random() * 0.35), t + dur * 0.6);
      osc.frequency.linearRampToValueAtTime(base * 0.9, t + dur);
      band.type = "bandpass";
      band.frequency.value = 600 + Math.random() * 500;
      band.Q.value = 9;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + dur * 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(band).connect(env).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    schedule(nextIn(5, 13, strain), creak);
  };

  /** A harbour bell, far off: soft partials with a long ring. Louder in port, rarer at sea. */
  const bell = () => {
    const near = mood.atPort ? 1 : 0.35;
    const out = voice(0.05 * near);
    const t = c.currentTime;
    const strikes = mood.atPort ? 2 : 1;
    for (let k = 0; k < strikes; k++) {
      const at = t + k * 1.1;
      for (const [ratio, level, dur] of [
        [1, 1, 3.5],
        [2.76, 0.3, 1.6],
        [5.4, 0.1, 0.7],
      ] as const) {
        const osc = c.createOscillator();
        const env = c.createGain();
        osc.frequency.value = 620 * ratio;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(level, at + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(env).connect(out);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      }
    }
    schedule(mood.atPort ? nextIn(18, 34) : nextIn(45, 90), bell);
  };

  /** Gulls by daylight in calm air: two quick falling cries. */
  const gull = () => {
    const daylight = 1 - mood.darkness;
    if (daylight > 0.4 && mood.intensity < 0.6) {
      const out = voice(0.018 * daylight * (mood.atPort ? 1.4 : 0.8));
      const t = c.currentTime;
      const cries = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < cries; k++) {
        const at = t + k * 0.32;
        const osc = c.createOscillator();
        const env = c.createGain();
        const top = 1500 + Math.random() * 500;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(top * 0.85, at);
        osc.frequency.linearRampToValueAtTime(top, at + 0.05);
        osc.frequency.exponentialRampToValueAtTime(top * 0.55, at + 0.26);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(1, at + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
        osc.connect(env).connect(out);
        osc.start(at);
        osc.stop(at + 0.32);
      }
    }
    schedule(nextIn(14, 32), gull);
  };

  schedule(nextIn(2, 6), creak);
  schedule(nextIn(4, 10), bell);
  schedule(nextIn(6, 14), gull);

  return {
    update(next) {
      mood = next;
      apply(1.2);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearTimeout);
      timers.clear();
      const t = c.currentTime;
      bed.gain.cancelScheduledValues(t);
      bed.gain.setTargetAtTime(0, t, 0.6);
      layers.forEach((l) => l.stop(t + 3));
    },
  };
}

/** Runs the soundscape while `active`, following `mood` as the voyage changes. */
export function useSoundscape(active: boolean, mood: SoundscapeMood) {
  const scape = useRef<Soundscape | null>(null);
  const latest = useRef(mood);

  useEffect(() => {
    latest.current = mood;
  });

  useEffect(() => {
    if (!active) return;
    scape.current = startSoundscape(latest.current);
    return () => {
      scape.current?.stop();
      scape.current = null;
    };
  }, [active]);

  const { intensity, sailing, atPort, darkness, danger } = mood;
  useEffect(() => {
    scape.current?.update({ intensity, sailing, atPort, darkness, danger });
  }, [intensity, sailing, atPort, darkness, danger]);
}
