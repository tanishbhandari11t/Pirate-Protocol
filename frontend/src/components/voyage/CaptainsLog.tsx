"use client";

import { useMemo, useState } from "react";
import { captainsLogText, writeCaptainsLog, type CaptainsLog as Log, type ChapterMood } from "@/lib/game/captainsLog";
import type { RoomState } from "@/lib/socket/contract";
import { ScrollIcon } from "../icons";
import { Button } from "../ui/Button";
import { useNotify } from "../ui/Notifications";

const MOOD: Record<ChapterMood, { glyph: string; label: string; ink: string }> = {
  triumph: { glyph: "✦", label: "Triumph", ink: "#8a6a12" },
  peril: { glyph: "☠", label: "Peril", ink: "#7a1f1a" },
  intrigue: { glyph: "⚓", label: "Intrigue", ink: "#2c4a5a" },
  calm: { glyph: "~", label: "Calm seas", ink: "#5b4a33" },
};

function fontOf(className: string) {
  const probe = document.createElement("span");
  probe.className = className;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || "serif";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders the log onto a parchment page and downloads it as a PNG. */
async function renderLogPicture(log: Log): Promise<Blob> {
  await document.fonts?.ready;
  const display = fontOf("font-display");
  const body = fontOf("font-body");
  const W = 1080;
  const PAD = 90;
  const TEXT_W = W - PAD * 2 - 70;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("This browser can't draw pictures.");
  measure.font = `28px ${body}`;
  const prologue = wrap(measure, log.prologue, W - PAD * 2);
  const chapters = log.chapters.map((c) => wrap(measure, c.text, TEXT_W));
  const epilogue = wrap(measure, log.epilogue, W - PAD * 2);
  const height = 330 + prologue.length * 40 + 30 + chapters.reduce((n, l) => n + l.length * 38 + 26, 0) + 40 + epilogue.length * 40 + 140;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw pictures.");

  const paper = ctx.createRadialGradient(W / 2, height / 2, 100, W / 2, height / 2, Math.max(W, height));
  paper.addColorStop(0, "#f4e4c1");
  paper.addColorStop(1, "#c9a96e");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, height);
  ctx.strokeStyle = "rgba(43, 29, 14, 0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, height - 60);
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, W - 84, height - 84);

  ctx.textAlign = "center";
  ctx.fillStyle = "#2b1d0e";
  ctx.font = `20px ${display}`;
  ctx.fillText("☠  THE CAPTAIN'S LOG  ☠", W / 2, 120);
  ctx.font = `64px ${display}`;
  ctx.fillText(log.title, W / 2, 200, W - PAD * 2);
  ctx.font = `italic 26px ${body}`;
  ctx.fillStyle = "#5b4a33";
  ctx.fillText(log.subtitle, W / 2, 245, W - PAD * 2);

  let y = 320;
  ctx.textAlign = "left";
  ctx.font = `italic 28px ${body}`;
  ctx.fillStyle = "#3a2a16";
  for (const line of prologue) {
    ctx.fillText(line, PAD, y);
    y += 40;
  }
  y += 30;

  log.chapters.forEach((chapter, i) => {
    const mood = MOOD[chapter.mood];
    ctx.font = `18px ${display}`;
    ctx.fillStyle = mood.ink;
    ctx.fillText(`${mood.glyph} ${chapter.clock}`, PAD, y);
    ctx.font = `28px ${body}`;
    ctx.fillStyle = "#2b1d0e";
    for (const line of chapters[i]) {
      ctx.fillText(line, PAD + 90, y);
      y += 38;
    }
    y += 26;
  });

  y += 20;
  ctx.font = `italic 28px ${body}`;
  ctx.fillStyle = "#3a2a16";
  for (const line of epilogue) {
    ctx.fillText(line, PAD, y);
    y += 40;
  }
  ctx.textAlign = "center";
  ctx.font = `16px ${display}`;
  ctx.fillStyle = "rgba(43, 29, 14, 0.6)";
  ctx.fillText("PIRATE PROTOCOL", W / 2, height - 70);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The page wouldn't dry. Try again.");
  return blob;
}

async function downloadLogPicture(log: Log, fileStem: string) {
  const url = URL.createObjectURL(await renderLogPicture(log));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileStem}-captains-log.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const canShareFiles = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [new File([""], "probe.png", { type: "image/png" })] });

/** The voyage told as a story, built only from events the server recorded. */
export function CaptainsLog({ room, meId }: { room: RoomState; meId: string }) {
  const log = useMemo(() => writeCaptainsLog(room, meId), [room, meId]);
  const { notify } = useNotify();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareable] = useState(canShareFiles);
  const stem = room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "voyage";

  if (log.chapters.length === 0) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(captainsLogText(log));
      notify({ tone: "success", title: "Log copied", message: "Paste it wherever your crew gathers." });
    } catch {
      notify({ tone: "danger", title: "Couldn't copy", message: "Your browser blocked the clipboard." });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await downloadLogPicture(log, stem);
      notify({ tone: "success", title: "Log saved", message: "The page is in your downloads." });
    } catch (error) {
      notify({ tone: "danger", title: "The ink smudged", message: error instanceof Error ? error.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const file = new File([await renderLogPicture(log)], `${stem}-captains-log.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: `${room.name}: the Captain's Log`, text: log.epilogue });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notify({ tone: "danger", title: "Couldn't share", message: "Save the picture instead and send it by hand." });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-2xl text-left" aria-labelledby="captains-log-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="captains-log-title" className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.35em] text-ink-soft/80">
          The Captain&apos;s Log
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="parchment" onClick={copy}>
            Copy log
          </Button>
          <Button size="sm" variant="parchment" icon={<ScrollIcon size={14} />} onClick={save} loading={saving}>
            Save as picture
          </Button>
          {shareable && (
            <Button size="sm" variant="brass" onClick={share} loading={sharing}>
              Share
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-ink/20 bg-parchment-light/50 px-5 py-4">
        <h3 className="font-display text-2xl uppercase tracking-wider text-ink">{log.title}</h3>
        <p className="font-body text-sm italic text-ink-soft">{log.subtitle}</p>
        <p className="mt-3 font-body italic text-ink-soft">{log.prologue}</p>
        <ol className="mt-4 space-y-2.5">
          {log.chapters.map((chapter) => {
            const mood = MOOD[chapter.mood];
            return (
              <li key={chapter.id} className="grid grid-cols-[4.5rem_1fr] gap-2">
                <span className="font-ui text-xs tabular-nums" style={{ color: mood.ink }}>
                  <span aria-label={mood.label} role="img">
                    {mood.glyph}
                  </span>{" "}
                  {chapter.clock}
                </span>
                <p className="font-body text-ink">{chapter.text}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 font-body italic text-ink-soft">{log.epilogue}</p>
      </div>
    </section>
  );
}
