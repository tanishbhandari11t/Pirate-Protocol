"use client";

import { useSyncExternalStore } from "react";

/** Every sound is synthesised with Web Audio, so the game ships no audio files. */
export type Sfx =
  | "sail"
  | "solve"
  | "fail"
  | "relic"
  | "trap"
  | "vault"
  | "treasure"
  | "thunder"
  | "rumble"
  | "bell"
  | "chat"
  | "coin"
  | "honour"
  | "splash"
  | "cannon";

const MUTE_KEY = "pp:muted";
const VOLUME_KEY = "pp:volume";
const MUSIC_KEY = "pp:music";
const DEFAULT_VOLUME = 0.8;

export interface SoundSettings {
  muted: boolean;
  /** Master level, 0–1. */
  volume: number;
  /** Whether the shanty plays under the game. */
  music: boolean;
}

const SERVER_SETTINGS: SoundSettings = { muted: false, volume: DEFAULT_VOLUME, music: true };

function readSettings(): SoundSettings {
  if (typeof window === "undefined") return SERVER_SETTINGS;
  const stored = Number(localStorage.getItem(VOLUME_KEY));
  return {
    muted: localStorage.getItem(MUTE_KEY) === "1",
    volume: Number.isFinite(stored) && localStorage.getItem(VOLUME_KEY) !== null ? clamp01(stored) : DEFAULT_VOLUME,
    music: localStorage.getItem(MUSIC_KEY) !== "0",
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

let settings = readSettings();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const listeners = new Set<() => void>();

const level = () => (settings.muted ? 0 : settings.volume);

/** Browsers keep audio suspended until the first gesture, so resume on whichever comes first. */
function unlockOnGesture() {
  const unlock = () => void ctx?.resume();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function audio() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    unlockOnGesture();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** The shared context and master bus, for modules (like the shanty) that schedule their own notes. */
export function audioBus(): { c: AudioContext; out: GainNode } | null {
  const c = audio();
  return c && master ? { c, out: master } : null;
}

/** Two seconds of brown noise: the raw material for surf, wind and hiss. */
export function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = noise.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return noise;
}

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  start?: number;
  dur: number;
  gain?: number;
}

function tone(c: AudioContext, out: AudioNode, { freq, to, type = "sine", start = 0, dur, gain = 0.2 }: ToneOptions) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface HissOptions {
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  start?: number;
  dur: number;
  gain?: number;
  /** Seconds to reach full level; defaults to 30% of the duration. */
  attack?: number;
}

function hiss(c: AudioContext, out: AudioNode, { filter, freq, to, start = 0, dur, gain = 0.2, attack }: HissOptions) {
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  const band = c.createBiquadFilter();
  const env = c.createGain();
  src.buffer = noiseBuffer(c);
  band.type = filter;
  band.frequency.setValueAtTime(freq, t);
  if (to) band.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + (attack ?? dur * 0.3));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band).connect(env).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

type Recipe = (play: { tone: (o: ToneOptions) => void; hiss: (o: HissOptions) => void }) => void;

const RECIPES: Record<Sfx, Recipe> = {
  sail: ({ tone, hiss }) => {
    hiss({ filter: "lowpass", freq: 300, to: 1400, dur: 1.4, gain: 0.35 });
    tone({ type: "sawtooth", freq: 210, to: 150, start: 0.25, dur: 0.3, gain: 0.03 });
    tone({ type: "sawtooth", freq: 190, to: 130, start: 0.85, dur: 0.35, gain: 0.03 });
  },
  solve: ({ tone }) => {
    tone({ type: "triangle", freq: 523, dur: 0.4 });
    tone({ type: "triangle", freq: 784, start: 0.12, dur: 0.7 });
  },
  fail: ({ tone }) => {
    tone({ type: "triangle", freq: 220, to: 196, dur: 0.35, gain: 0.15 });
    tone({ type: "triangle", freq: 185, to: 160, start: 0.18, dur: 0.5, gain: 0.15 });
  },
  relic: ({ tone, hiss }) => {
    [659, 784, 988, 1319].forEach((freq, i) => tone({ freq, start: i * 0.09, dur: 1.3, gain: 0.13 }));
    hiss({ filter: "highpass", freq: 6000, start: 0.2, dur: 1, gain: 0.05 });
  },
  trap: ({ tone, hiss }) => {
    tone({ freq: 140, to: 36, dur: 0.9, gain: 0.7 });
    hiss({ filter: "lowpass", freq: 500, to: 120, dur: 0.7, gain: 0.5 });
    tone({ type: "square", freq: 60, start: 0.45, dur: 0.25, gain: 0.08 });
    tone({ type: "square", freq: 60, start: 0.75, dur: 0.25, gain: 0.06 });
  },
  vault: ({ tone }) => {
    tone({ freq: 110, dur: 3 });
    tone({ freq: 165, dur: 3, gain: 0.12 });
    [440, 554, 659, 880].forEach((freq, i) => tone({ type: "triangle", freq, start: 0.6 + i * 0.25, dur: 1.6, gain: 0.1 }));
  },
  treasure: ({ tone }) => {
    tone({ type: "sawtooth", freq: 110, to: 260, dur: 0.8, gain: 0.04 });
    for (let i = 0; i < 16; i++) tone({ freq: 2000 + Math.random() * 2200, start: 0.9 + i * 0.07, dur: 0.14, gain: 0.05 });
    [523, 659, 784, 1047].forEach((freq) => tone({ type: "triangle", freq, start: 1.1, dur: 2.8, gain: 0.08 }));
  },
  thunder: ({ tone, hiss }) => {
    hiss({ filter: "lowpass", freq: 2400, to: 90, dur: 0.35, gain: 0.55, attack: 0.01 });
    hiss({ filter: "lowpass", freq: 260, to: 60, start: 0.12, dur: 3.2, gain: 0.7, attack: 0.25 });
    hiss({ filter: "bandpass", freq: 140, start: 0.9, dur: 1.6, gain: 0.35 });
    tone({ freq: 48, to: 30, start: 0.1, dur: 2.4, gain: 0.35 });
  },
  rumble: ({ tone, hiss }) => {
    hiss({ filter: "lowpass", freq: 220, to: 50, dur: 3.6, gain: 0.32, attack: 0.6 });
    hiss({ filter: "bandpass", freq: 110, start: 0.5, dur: 2.2, gain: 0.16 });
    tone({ freq: 40, to: 28, start: 0.2, dur: 2.8, gain: 0.14 });
  },
  bell: ({ tone }) => {
    for (const at of [0, 0.42]) {
      tone({ freq: 880, start: at, dur: 2.4, gain: 0.12 });
      tone({ freq: 880 * 2.76, start: at, dur: 1.1, gain: 0.035 });
      tone({ freq: 880 * 5.4, start: at, dur: 0.5, gain: 0.015 });
      tone({ freq: 440, start: at, dur: 2.8, gain: 0.05 });
    }
  },
  chat: ({ tone }) => {
    tone({ type: "triangle", freq: 1175, dur: 0.09, gain: 0.06 });
    tone({ type: "triangle", freq: 1568, start: 0.07, dur: 0.12, gain: 0.05 });
  },
  coin: ({ tone }) => {
    tone({ type: "square", freq: 1976, dur: 0.07, gain: 0.03 });
    tone({ type: "square", freq: 2637, start: 0.06, dur: 0.22, gain: 0.03 });
  },
  honour: ({ tone, hiss }) => {
    [392, 523, 659, 784].forEach((freq, i) => tone({ type: "triangle", freq, start: i * 0.11, dur: 0.5, gain: 0.1 }));
    [523, 659, 784, 1047].forEach((freq) => tone({ freq, start: 0.5, dur: 1.8, gain: 0.06 }));
    hiss({ filter: "highpass", freq: 7000, start: 0.45, dur: 1.2, gain: 0.04 });
  },
  splash: ({ hiss, tone }) => {
    hiss({ filter: "bandpass", freq: 900, to: 300, dur: 0.9, gain: 0.45, attack: 0.03 });
    hiss({ filter: "highpass", freq: 3000, start: 0.05, dur: 0.6, gain: 0.12 });
    tone({ freq: 220, to: 80, dur: 0.3, gain: 0.12 });
  },
  cannon: ({ hiss, tone }) => {
    tone({ freq: 90, to: 28, dur: 1.1, gain: 0.8 });
    hiss({ filter: "lowpass", freq: 1800, to: 100, dur: 1.4, gain: 0.6, attack: 0.005 });
    hiss({ filter: "lowpass", freq: 300, start: 0.3, dur: 2.2, gain: 0.25 });
  },
};

export function playSfx(name: Sfx) {
  const c = audio();
  const out = master;
  if (!c || !out || settings.muted) return;
  RECIPES[name]({ tone: (o) => tone(c, out, o), hiss: (o) => hiss(c, out, o) });
}

/** Phone haptics; silently ignored where unsupported or when the player has muted the game. */
export function vibrate(pattern: number | number[]) {
  if (!settings.muted && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/** Starts the rolling surf under the voyage; call the returned function to let it fade. */
export function startAmbience() {
  const c = audio();
  if (!c || !master) return () => undefined;
  const src = c.createBufferSource();
  const lowpass = c.createBiquadFilter();
  const swell = c.createGain();
  const lfo = c.createOscillator();
  const depth = c.createGain();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  lowpass.type = "lowpass";
  lowpass.frequency.value = 480;
  swell.gain.value = 0.12;
  lfo.frequency.value = 0.12;
  depth.gain.value = 0.08;
  lfo.connect(depth).connect(swell.gain);
  src.connect(lowpass).connect(swell).connect(master);
  src.start();
  lfo.start();
  return () => {
    const t = c.currentTime;
    swell.gain.cancelScheduledValues(t);
    swell.gain.setTargetAtTime(0, t, 0.3);
    src.stop(t + 1.5);
    lfo.stop(t + 1.5);
  };
}

/** Howling wind layered on the surf while a storm is over the chart. */
export function startGale() {
  const c = audio();
  if (!c || !master) return () => undefined;
  const src = c.createBufferSource();
  const band = c.createBiquadFilter();
  const gain = c.createGain();
  const lfo = c.createOscillator();
  const depth = c.createGain();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  band.type = "bandpass";
  band.frequency.value = 700;
  band.Q.value = 2.2;
  lfo.frequency.value = 0.21;
  depth.gain.value = 380;
  lfo.connect(depth).connect(band.frequency);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.setTargetAtTime(0.16, c.currentTime, 1.2);
  src.connect(band).connect(gain).connect(master);
  src.start();
  lfo.start();
  return () => {
    const t = c.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0, t, 0.8);
    src.stop(t + 4);
    lfo.stop(t + 4);
  };
}

function update(patch: Partial<SoundSettings>) {
  settings = { ...settings, ...patch };
  localStorage.setItem(MUTE_KEY, settings.muted ? "1" : "0");
  localStorage.setItem(VOLUME_KEY, settings.volume.toFixed(2));
  localStorage.setItem(MUSIC_KEY, settings.music ? "1" : "0");
  if (ctx && master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05);
  listeners.forEach((listener) => listener());
}

export const toggleMuted = () => update({ muted: !settings.muted });
export const setVolume = (volume: number) => update({ volume: clamp01(volume), muted: volume <= 0 });
export const setMusic = (music: boolean) => update({ music });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useSoundSettings() {
  return useSyncExternalStore(
    subscribe,
    () => settings,
    () => SERVER_SETTINGS,
  );
}

export function useMuted() {
  return useSoundSettings().muted;
}
