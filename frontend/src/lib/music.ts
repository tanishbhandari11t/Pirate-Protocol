"use client";

import { useEffect } from "react";
import { audioBus, noiseBuffer, useSoundSettings } from "./sound";

/**
 * A synthesised arrangement of "What Shall We Do with the Drunken Sailor" (traditional, public domain).
 * Notes are scheduled slightly ahead of the audio clock so timing stays tight even when React is busy.
 */
export type Mood = "harbour" | "voyage" | "tempest";

interface Arrangement {
  bpm: number;
  /** Semitones added to every note. */
  transpose: number;
  lead: { gain: number; wave: OscillatorType; cutoff: number; octave: number };
  bass: number;
  chords: number;
  /** Bodhrán hits per bar of eight steps, with their level. */
  drum: { steps: Record<number, number>; gain: number };
  snare: { steps: number[]; gain: number };
  /** Sustain chords across the bar instead of stabbing them on the beat. */
  pad: boolean;
}

const ARRANGEMENTS: Record<Mood, Arrangement> = {
  harbour: {
    bpm: 84,
    transpose: 0,
    lead: { gain: 0.045, wave: "triangle", cutoff: 1800, octave: 0 },
    bass: 0.06,
    chords: 0.03,
    drum: { steps: {}, gain: 0 },
    snare: { steps: [], gain: 0 },
    pad: true,
  },
  voyage: {
    bpm: 126,
    transpose: 0,
    lead: { gain: 0.05, wave: "sawtooth", cutoff: 2400, octave: 0 },
    bass: 0.085,
    chords: 0.022,
    drum: { steps: { 0: 1, 3: 0.55, 4: 0.8, 6: 0.5 }, gain: 0.22 },
    snare: { steps: [], gain: 0 },
    pad: false,
  },
  tempest: {
    bpm: 158,
    transpose: -1,
    lead: { gain: 0.055, wave: "square", cutoff: 1500, octave: -1 },
    bass: 0.11,
    chords: 0.018,
    drum: { steps: { 0: 1, 1: 0.4, 2: 0.7, 3: 0.4, 4: 1, 5: 0.4, 6: 0.7, 7: 0.5 }, gain: 0.26 },
    snare: { steps: [2, 6], gain: 0.07 },
    pad: false,
  },
};

/** One token per eighth note: a pitch, `-` to hold the previous note, `.` for silence. */
const MELODY = [
  // Verse
  "A4 - A4 A4 A4 - A4 A4",
  "A4 - D4 - F4 - A4 -",
  "G4 - G4 G4 G4 - G4 G4",
  "G4 - C4 - E4 - G4 -",
  "A4 - A4 A4 A4 - A4 A4",
  "A4 - B4 - C5 - D5 -",
  "C5 - A4 - G4 - E4 -",
  "D4 - - - D4 - . .",
  // Chorus
  "A4 - - - A4 - A4 A4",
  "A4 - D4 - F4 - A4 -",
  "G4 - - - G4 - G4 G4",
  "G4 - C4 - E4 - G4 -",
  "A4 - - - A4 - A4 A4",
  "A4 - B4 - C5 - D5 -",
  "C5 - A4 - G4 - E4 -",
  "D4 - - - D4 - - -",
];

const CHORDS: Record<string, number[]> = {
  Dm: [50, 53, 57],
  C: [48, 52, 55],
  Am: [45, 48, 52],
};
const PROGRESSION = ["Dm", "Dm", "C", "C", "Dm", "Dm", "Am", "Dm"];

const STEPS_PER_BAR = 8;

interface Note {
  midi: number;
  steps: number;
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function toMidi(token: string) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(token);
  if (!match) throw new Error(`Bad note "${token}"`);
  const [, letter, accidental, octave] = match;
  return 12 * (Number(octave) + 1) + NAMES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
}

/** Flattens the melody into a step-indexed table of note starts with their lengths. */
function compile(bars: string[]) {
  const tokens = bars.flatMap((bar) => bar.trim().split(/\s+/));
  const starts = new Map<number, Note>();
  let open: Note | null = null;
  tokens.forEach((token, step) => {
    if (token === "-") {
      if (open) open.steps += 1;
      return;
    }
    if (token === ".") {
      open = null;
      return;
    }
    open = { midi: toMidi(token), steps: 1 };
    starts.set(step, open);
  });
  return { starts, length: tokens.length };
}

const SCORE = compile(MELODY);
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/* ------------------------------------------------------------------ */
/* Instruments                                                          */
/* ------------------------------------------------------------------ */

function fiddle(c: AudioContext, out: AudioNode, midi: number, t: number, dur: number, lead: Arrangement["lead"]) {
  const filter = c.createBiquadFilter();
  const env = c.createGain();
  const vibrato = c.createOscillator();
  const depth = c.createGain();
  filter.type = "lowpass";
  filter.frequency.value = lead.cutoff;
  vibrato.frequency.value = 5.6;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(freq(midi) * 0.006, t + Math.min(0.25, dur));
  vibrato.connect(depth);

  for (const detune of [-5, 5]) {
    const osc = c.createOscillator();
    osc.type = lead.wave;
    osc.frequency.value = freq(midi);
    osc.detune.value = detune;
    depth.connect(osc.frequency);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(lead.gain, t + 0.03);
  env.gain.setValueAtTime(lead.gain * 0.85, t + Math.max(0.04, dur - 0.06));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  filter.connect(env).connect(out);
  vibrato.start(t);
  vibrato.stop(t + dur + 0.1);
}

function pluck(c: AudioContext, out: AudioNode, midi: number, t: number, dur: number, gain: number) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq(midi);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function squeeze(c: AudioContext, out: AudioNode, notes: number[], t: number, dur: number, gain: number) {
  const filter = c.createBiquadFilter();
  const env = c.createGain();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  for (const midi of notes) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq(midi + 12);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.15);
  }
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.06);
  env.gain.setValueAtTime(gain, t + Math.max(0.07, dur - 0.05));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  filter.connect(env).connect(out);
}

function bodhran(c: AudioContext, out: AudioNode, t: number, gain: number) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.3);

  const skin = c.createBufferSource();
  const band = c.createBiquadFilter();
  const skinEnv = c.createGain();
  skin.buffer = noiseBuffer(c);
  band.type = "lowpass";
  band.frequency.value = 420;
  skinEnv.gain.setValueAtTime(gain * 0.6, t);
  skinEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  skin.connect(band).connect(skinEnv).connect(out);
  skin.start(t, Math.random());
  skin.stop(t + 0.12);
}

function snap(c: AudioContext, out: AudioNode, t: number, gain: number) {
  const src = c.createBufferSource();
  const band = c.createBiquadFilter();
  const env = c.createGain();
  src.buffer = noiseBuffer(c);
  band.type = "highpass";
  band.frequency.value = 1800;
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(band).connect(env).connect(out);
  src.start(t, Math.random());
  src.stop(t + 0.15);
}

/* ------------------------------------------------------------------ */
/* Sequencer                                                            */
/* ------------------------------------------------------------------ */

const LOOKAHEAD_S = 0.15;
const TICK_MS = 40;
const MUSIC_LEVEL = 0.55;

const player: {
  mood: Mood | null;
  bus: GainNode | null;
  timer: number | null;
  stopTimer: number | null;
  step: number;
  next: number;
} = { mood: null, bus: null, timer: null, stopTimer: null, step: 0, next: 0 };

function scheduleStep(c: AudioContext, out: AudioNode, step: number, t: number, arr: Arrangement) {
  const stepDur = 60 / arr.bpm / 2;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const beat = step % STEPS_PER_BAR;
  const chord = CHORDS[PROGRESSION[bar % PROGRESSION.length]].map((m) => m + arr.transpose);

  const note = SCORE.starts.get(step);
  if (note) fiddle(c, out, note.midi + arr.transpose + arr.lead.octave * 12, t, note.steps * stepDur * 0.95, arr.lead);

  if (beat % 2 === 0) {
    const root = chord[0] - 12;
    pluck(c, out, beat % 4 === 0 ? root : root + 7, t, stepDur * 1.8, arr.bass);
  }

  if (arr.pad ? beat === 0 : beat === 1 || beat === 5) {
    squeeze(c, out, chord, t, arr.pad ? stepDur * 7.6 : stepDur * 0.8, arr.chords);
  }

  const hit = arr.drum.steps[beat];
  if (hit) bodhran(c, out, t, arr.drum.gain * hit);
  if (arr.snare.steps.includes(beat)) snap(c, out, t, arr.snare.gain);
}

function tick() {
  const audio = audioBus();
  if (!audio || !player.bus || !player.mood) return;
  const { c } = audio;
  const arr = ARRANGEMENTS[player.mood];
  // A throttled background tab can fall behind; skip ahead instead of firing a burst of stale notes.
  if (player.next < c.currentTime - 0.05) player.next = c.currentTime + 0.05;
  while (player.next < c.currentTime + LOOKAHEAD_S) {
    scheduleStep(c, player.bus, player.step, player.next, arr);
    player.next += 60 / arr.bpm / 2;
    player.step = (player.step + 1) % SCORE.length;
  }
}

function setMood(mood: Mood | null) {
  const audio = audioBus();
  if (!audio) return;
  const { c, out } = audio;
  const t = c.currentTime;

  if (mood === null) {
    if (!player.bus || player.mood === null) return;
    player.mood = null;
    player.bus.gain.cancelScheduledValues(t);
    player.bus.gain.setTargetAtTime(0.0001, t, 0.35);
    if (player.stopTimer) window.clearTimeout(player.stopTimer);
    player.stopTimer = window.setTimeout(() => {
      if (player.mood !== null) return;
      if (player.timer) window.clearInterval(player.timer);
      player.timer = null;
      player.step = 0;
    }, 1600);
    return;
  }

  if (player.stopTimer) window.clearTimeout(player.stopTimer);
  player.stopTimer = null;
  if (!player.bus) {
    player.bus = c.createGain();
    player.bus.gain.value = 0.0001;
    player.bus.connect(out);
  }
  player.mood = mood;
  player.bus.gain.cancelScheduledValues(t);
  player.bus.gain.setTargetAtTime(MUSIC_LEVEL, t, 0.8);
  if (player.timer === null) {
    player.next = t + 0.1;
    player.timer = window.setInterval(tick, TICK_MS);
  }
}

/** Plays the shanty in the given mood while mounted; `null` lets it fade out. Honours mute and the music toggle. */
export function useShanty(mood: Mood | null) {
  const { muted, music } = useSoundSettings();
  const active = mood && music && !muted ? mood : null;
  useEffect(() => {
    setMood(active);
    return () => setMood(null);
  }, [active]);
}
