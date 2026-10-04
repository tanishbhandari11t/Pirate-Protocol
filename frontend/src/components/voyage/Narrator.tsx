"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { narrateEvent, type Told } from "@/lib/game/captainsLog";
import { onServerEvent } from "@/lib/socket/client";
import type { RoomState } from "@/lib/socket/contract";

const VOICE_KEY = "pp:narrator-voice";
const SHOW_MS = 6_500;
const voiceListeners = new Set<() => void>();

const voiceStore = {
  get: () => {
    try {
      return window.localStorage.getItem(VOICE_KEY) === "on";
    } catch {
      return false;
    }
  },
  set(on: boolean) {
    try {
      window.localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {
      /* the choice just won't be remembered */
    }
    if (!on) window.speechSynthesis?.cancel();
    voiceListeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    voiceListeners.add(l);
    return () => voiceListeners.delete(l);
  },
};

const MOOD_GLYPH: Record<Told["mood"], string> = { triumph: "✦", peril: "☠", intrigue: "⚓", calm: "~" };

function speak(text: string, soft: boolean) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return;
  synth.cancel();
  const line = new SpeechSynthesisUtterance(text);
  line.rate = 0.95;
  line.pitch = 0.8;
  line.volume = soft ? 0.45 : 0.9;
  const voice = synth.getVoices().find((v) => /en-GB/i.test(v.lang)) ?? null;
  if (voice) line.voice = voice;
  synth.speak(line);
}

interface NarratorProps {
  room: RoomState;
  meId: string;
  /** Silent Waters: the narrator keeps his voice down. */
  hushed?: boolean;
}

/**
 * Narrates the voyage as it happens, one subtitle per notable event. Lines are prewritten and only
 * ever describe events the server sent; spoken narration is optional and off by default.
 */
export function Narrator({ room, meId, hushed = false }: NarratorProps) {
  const [line, setLine] = useState<(Told & { id: string }) | null>(null);
  const voice = useSyncExternalStore(voiceStore.subscribe, voiceStore.get, () => false);
  const roomRef = useRef(room);
  const settings = useRef({ voice, hushed, meId });

  useEffect(() => {
    roomRef.current = room;
    settings.current = { voice, hushed, meId };
  });

  useEffect(() => {
    let hide: number | undefined;
    const off = onServerEvent("game:event", (event) => {
      const told = narrateEvent(roomRef.current, settings.current.meId, event);
      if (!told) return;
      setLine({ ...told, id: event.id });
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setLine(null), SHOW_MS);
      if (settings.current.voice) speak(told.text, settings.current.hushed);
    });
    return () => {
      off();
      window.clearTimeout(hide);
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-8" aria-live="polite">
        <AnimatePresence mode="wait">
          {line && (
            <motion.p
              key={line.id}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45 }}
              className="max-w-2xl rounded-md border border-brass/30 bg-abyss/85 px-4 py-2 text-center font-body text-base italic text-parchment shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:text-lg"
            >
              <span aria-hidden className="mr-2 not-italic text-gold">
                {MOOD_GLYPH[line.mood]}
              </span>
              {line.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={voice}
        onClick={() => voiceStore.set(!voice)}
        title={voice ? "Silence the narrator's voice" : "Let the narrator speak aloud"}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-brass/40 bg-abyss/80 px-3 py-1.5 font-ui text-[0.55rem] uppercase tracking-[0.2em] text-brass-light backdrop-blur-sm hover:bg-brass/15"
      >
        {voice ? "🗣 Narrator on" : "🔇 Narrator voice"}
      </button>
    </>
  );
}
