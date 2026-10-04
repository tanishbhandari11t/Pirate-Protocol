import type { VoyageStats } from "@/lib/game/selectors";
import { seeded } from "@/lib/random";
import type { RoomState } from "@/lib/socket/contract";

const W = 900;
const H = 1200;
const INK = "#2b1b0d";
const INK_SOFT = "#57391d";
const BLOOD = "#8e1f1a";

/** Resolves a next/font CSS variable to the real family name so the canvas draws in the game's typefaces. */
function family(variable: string, fallback: string) {
  const name = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return name ? `${name}, ${fallback}` : fallback;
}

function drawParchment(g: CanvasRenderingContext2D, seed: number) {
  const paper = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 820);
  paper.addColorStop(0, "#f5e8c6");
  paper.addColorStop(0.7, "#e2c995");
  paper.addColorStop(1, "#a97e45");
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);

  const rand = seeded(seed);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(87, 57, 29, ${rand() * 0.14})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 3);
  }

  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.lineWidth = 2;
  g.strokeRect(58, 58, W - 116, H - 116);
}

export async function downloadWantedPoster(room: RoomState, stats: VoyageStats, duration: string | null) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser cannot draw the poster.");

  const display = family("--font-pirata", "Georgia, serif");
  const body = family("--font-fell", "Georgia, serif");
  const ui = family("--font-cinzel", "Georgia, serif");
  const seed = [...room.code].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  drawParchment(g, seed);

  const text = (value: string, y: number, font: string, color = INK) => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = "center";
    g.fillText(value, W / 2, y, W - 180);
  };
  const rule = (y: number) => {
    g.strokeStyle = INK_SOFT;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(160, y);
    g.lineTo(W - 160, y);
    g.stroke();
  };

  text("WANTED", 240, `200px ${display}`);
  text("DEAD OR ALIVE", 305, `bold 34px ${ui}`, INK_SOFT);
  rule(345);
  text("THE CREW OF", 410, `bold 26px ${ui}`, INK_SOFT);
  text(room.name.toUpperCase(), 490, `82px ${display}`, BLOOD);
  text(room.players.map((p) => p.username).join(" · "), 555, `italic 34px ${body}`);
  rule(600);

  [
    `${stats.islandsDiscovered} of ${stats.islandsTotal} islands charted`,
    `${stats.puzzlesSolved} riddles cracked`,
    `${stats.relicsRecovered} relics recovered`,
    `${stats.trapsSprung} traps sprung`,
  ].forEach((line, i) => text(line, 670 + i * 52, `italic 36px ${body}`));

  rule(880);
  text("REWARD", 940, `bold 34px ${ui}`, INK_SOFT);
  text(`${stats.plunder.toLocaleString()} DOUBLOONS`, 1035, `100px ${display}`, BLOOD);
  if (duration) text(`For a voyage of ${duration}`, 1090, `italic 30px ${body}`, INK_SOFT);
  text(`PIRATE PROTOCOL · SHIP ${room.code}`, 1135, `bold 20px ${ui}`, INK_SOFT);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The ink would not dry. Try again.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wanted-${room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || room.code}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
