"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cipherInfo } from "@/lib/game/world";
import { ANSWER_MAX, type PublicIsland, type PublicPuzzle } from "@/lib/socket/contract";
import { CloseIcon, CompassIcon } from "../icons";
import { Button } from "../ui/Button";
import { Seal } from "../ui/Ornaments";
import { InkFlourish } from "../ui/ParchmentCard";

export type PuzzleOutcome = { kind: "solved" } | { kind: "failed" } | { kind: "trap" } | { kind: "error"; message: string };

interface PuzzleOverlayProps {
  island: PublicIsland;
  puzzle: PublicPuzzle;
  isVault: boolean;
  onSubmit: (answer: string) => Promise<PuzzleOutcome>;
  onClose: () => void;
  /** Shown beneath the answer form while the puzzle is unsolved, e.g. the hint drawer. */
  footer?: ReactNode;
}

/** Letters the puzzle wants the reader to stare at: the cipher text or the scrambled word. */
function artifactLetters(puzzle: PublicPuzzle) {
  const match = puzzle.prompt.match(/(?:decode|rearrange):\s*([A-Za-z]+)/i);
  return match ? match[1].toUpperCase().split("") : null;
}

export function PuzzleOverlay({ island, puzzle, isVault, onSubmit, onClose, footer }: PuzzleOverlayProps) {
  const info = cipherInfo(puzzle.cipher);
  const letters = artifactLetters(puzzle);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const shake = useAnimationControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 450);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!solved) return;
    const timer = window.setTimeout(() => onCloseRef.current(), 1700);
    return () => window.clearTimeout(timer);
  }, [solved]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed || pending || solved) return;
    setPending(true);
    setMessage(null);
    const outcome = await onSubmit(trimmed);
    setPending(false);
    if (outcome.kind === "solved") {
      setSolved(true);
    } else if (outcome.kind === "trap") {
      onClose();
    } else {
      setMessage(outcome.kind === "failed" ? "The markings stay silent. That is not the answer." : outcome.message);
      shake.start({ x: [0, -14, 12, -8, 6, 0], transition: { duration: 0.45 } });
      inputRef.current?.select();
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={info.title}
    >
      <div className="absolute inset-0 bg-abyss/85" onClick={pending ? undefined : onClose} aria-hidden />
      <motion.div
        className="relative w-full max-w-xl"
        initial={{ scale: 0.7, rotateX: 55, y: 60 }}
        animate={{ scale: 1, rotateX: 0, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: "spring", stiffness: 170, damping: 22 }}
        style={{ transformPerspective: 1200 }}
      >
        <div
          aria-hidden
          className="absolute -inset-2 rounded-lg bg-[conic-gradient(from_200deg,#6f4f1c,#f1d68d,#c89b45,#6f4f1c,#e2b65a,#8d6524,#6f4f1c)] shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
        />
        <motion.div animate={shake} className="parchment relative max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-md px-5 pb-6 pt-7 text-ink sm:px-9 sm:pb-8">
          {!pending && !solved && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft transition hover:bg-ink/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
              aria-label="Close puzzle"
            >
              <CloseIcon size={18} />
            </button>
          )}

          <header className="text-center">
            <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.4em] text-ink-soft/80">
              {isVault ? "The Final Puzzle" : island.name}
            </p>
            <h2 className="ink-bleed mt-1 font-display text-3xl sm:text-4xl">{info.title}</h2>
            <InkFlourish className="mx-auto mt-2 w-40 text-ink-soft/70" />
          </header>

          <motion.p
            className="mt-4 text-center font-display text-2xl tracking-[0.35em] text-blood/80 sm:text-3xl"
            initial={{ opacity: 0, letterSpacing: "0.9em" }}
            animate={{ opacity: 1, letterSpacing: "0.35em" }}
            transition={{ duration: 1.1, delay: 0.2 }}
            aria-hidden
          >
            {info.glyphs}
          </motion.p>

          {letters && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-hidden>
              {letters.map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: -12, rotate: -20 }}
                  animate={{ opacity: 1, y: 0, rotate: (i % 3) - 1 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  className="flex h-10 w-8 items-center justify-center rounded-sm border border-ink/40 bg-parchment-light font-display text-2xl shadow-[0_2px_0_rgba(43,27,13,0.35)] sm:h-12 sm:w-10 sm:text-3xl"
                >
                  {letter}
                </motion.span>
              ))}
            </div>
          )}

          <p className="mt-5 text-center font-body text-lg leading-relaxed text-ink sm:text-xl">“{puzzle.prompt}”</p>
          <p className="mt-2 text-center font-body text-sm italic text-ink-soft/80">{info.hint}</p>

          <AnimatePresence mode="wait">
            {solved ? (
              <motion.div
                key="solved"
                className="mt-6 flex flex-col items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  initial={{ scale: 3, rotate: -40, opacity: 0 }}
                  animate={{ scale: 1.4, rotate: -12, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                >
                  <Seal tone="kelp">Solved</Seal>
                </motion.div>
                <p className="mt-5 font-body text-lg italic text-ink-soft">The markings shift and settle. The island yields its secret…</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} className="mt-6" exit={{ opacity: 0 }}>
                <label htmlFor="puzzle-answer" className="block text-center font-ui text-[0.62rem] font-bold uppercase tracking-[0.35em] text-ink-soft">
                  Your answer
                </label>
                <input
                  ref={inputRef}
                  id="puzzle-answer"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setMessage(null);
                  }}
                  maxLength={ANSWER_MAX}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={pending}
                  className="mx-auto mt-2 block h-14 w-full max-w-sm rounded-sm border-b-2 border-ink/60 bg-parchment-light/60 px-4 text-center font-display text-3xl text-ink outline-none transition placeholder:text-ink-soft/30 focus:border-blood focus:bg-parchment-light"
                  placeholder="…"
                  aria-invalid={!!message}
                  aria-describedby={message ? "puzzle-message" : undefined}
                />
                <p id="puzzle-message" role="alert" className="mt-2 min-h-6 text-center font-body italic text-blood">
                  {message}
                </p>
                <div className="mt-2 flex justify-center">
                  <Button type="submit" size="lg" loading={pending} disabled={!answer.trim()} icon={<CompassIcon size={18} />}>
                    {isVault ? "Speak the Protocol" : "Decode"}
                  </Button>
                </div>
                {island.kind === "TRAP" && (
                  <p className="mt-4 text-center font-body text-sm italic text-blood/80">A wrong answer here springs a trap.</p>
                )}
                {footer}
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
