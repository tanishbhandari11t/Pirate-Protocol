import type { FinishReason, GameEvent, PlayerId, PublicIsland, RoomState } from "../socket/contract";
import { itemInfo } from "./world";

/**
 * The Captain's Log: the server's event log retold as a short story. Every sentence is anchored to
 * a recorded event, so the tale can be dramatic without ever inventing something that didn't happen.
 */

export type ChapterMood = "triumph" | "peril" | "intrigue" | "calm";

export interface LogChapter {
  id: string;
  /** Milliseconds since the voyage began. */
  at: number;
  /** "mm:ss" into the voyage. */
  clock: string;
  mood: ChapterMood;
  text: string;
  playerId: PlayerId | null;
}

export interface CaptainsLog {
  title: string;
  subtitle: string;
  prologue: string;
  chapters: LogChapter[];
  epilogue: string;
}

/** Long voyages are trimmed to their most telling moments so the story stays readable. */
export const MAX_CHAPTERS = 18;

const SILENT = new Set(["PLAYER_JOINED", "SPECTATING", "MOVED"]);

/** Higher weight survives trimming; the finale and the turning points always stay. */
const WEIGHT: Record<string, number> = {
  TREASURE_FOUND: 100,
  CREW_WRECKED: 100,
  TIME_UP: 100,
  VAULT_AWAKENED: 90,
  TRAP_TRIGGERED: 70,
  TRADED: 60,
  PUZZLE_SOLVED: 50,
  ISLAND_DISCOVERED: 40,
  ITEM_GRANTED: 35,
  TIME_WARNING: 30,
  HINT_BOUGHT: 25,
  PLAYER_LEFT: 20,
  PUZZLE_FAILED: 15,
};

function hash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Picks a phrasing by event id, so the same voyage always reads the same way. */
function pick<T>(id: string, options: readonly T[]): T {
  return options[hash(id) % options.length];
}

export function formatVoyageClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Teller {
  room: RoomState;
  meId: PlayerId | null;
  name: (playerId: unknown) => string;
  island: (key: unknown) => string;
  puzzleIsland: (puzzleKey: unknown) => string;
}

function teller(room: RoomState, meId: PlayerId | null): Teller {
  const islandOf = (key: unknown): PublicIsland | undefined =>
    typeof key === "string" ? room.islands.find((i) => i.key === key) : undefined;
  return {
    room,
    meId,
    name: (playerId) => {
      if (typeof playerId !== "string") return "A sailor";
      if (playerId === meId) return "You";
      return room.players.find((p) => p.id === playerId)?.username ?? "A departed sailor";
    },
    island: (key) => islandOf(key)?.name ?? "an unknown shore",
    puzzleIsland: (puzzleKey) =>
      (typeof puzzleKey === "string" && room.islands.find((i) => i.puzzles.some((p) => p.key === puzzleKey))?.name) ||
      "an unknown shore",
  };
}

/** "You was" reads badly; the narrator conjugates for the reader. */
const be = (who: string) => (who === "You" ? "were" : "was");

export interface Told {
  mood: ChapterMood;
  text: string;
}

/**
 * One line for the live narrator: the same phrasing as the log, for a single fresh event. Earlier
 * events are replayed first so "the first riddle" lines only ever fire once.
 */
export function narrateEvent(room: RoomState, meId: PlayerId | null, event: GameEvent): Told | null {
  if (SILENT.has(event.type)) return null;
  const t = teller(room, meId);
  const firsts = new Set<string>();
  for (const e of room.log) {
    if (e.seq >= event.seq) break;
    tell(t, e, firsts);
  }
  return tell(t, event, firsts);
}

function tell(t: Teller, event: GameEvent, firsts: Set<string>): Told | null {
  const who = t.name(event.playerId);
  const p = event.payload as Record<string, unknown>;
  const first = (key: string) => {
    if (firsts.has(key)) return false;
    firsts.add(key);
    return true;
  };

  switch (event.type) {
    case "ISLAND_DISCOVERED": {
      const where = t.island(p.islandKey);
      return {
        mood: "calm",
        text: pick(event.id, [
          `${who} sighted ${where} through the fog, and the crew put it on the chart.`,
          `The fog tore open and ${where} rose out of the swell. ${who} saw it first.`,
          `${who} sailed into the unknown and found ${where} waiting.`,
        ]),
      };
    }
    case "PUZZLE_SOLVED": {
      const where = t.puzzleIsland(p.puzzleKey);
      if (first("solve")) {
        return { mood: "triumph", text: `${who} cracked the first riddle of the voyage, at ${where}. The hunt was on.` };
      }
      return {
        mood: "triumph",
        text: pick(event.id, [
          `${who} broke the riddle of ${where}.`,
          `At ${where}, ${who} read the markings true and the island gave up its secret.`,
          `${where} fell silent as ${who} spoke the answer.`,
        ]),
      };
    }
    case "PUZZLE_FAILED":
      return {
        mood: "peril",
        text: pick(event.id, [
          `${who} guessed wrong at ${t.puzzleIsland(p.puzzleKey)}, and the stones stayed shut.`,
          `A wrong word at ${t.puzzleIsland(p.puzzleKey)} cost ${who === "You" ? "you" : who} precious time.`,
        ]),
      };
    case "TRAP_TRIGGERED": {
      const where = t.puzzleIsland(p.puzzleKey);
      if (p.eliminated) return { mood: "peril", text: `${who} sprang the trap at ${where}, and the sea claimed ${who === "You" ? "you" : "them"}.` };
      const strikes = typeof p.strikes === "number" ? p.strikes : null;
      return {
        mood: "peril",
        text: pick(event.id, [
          `The trap at ${where} snapped shut on ${who === "You" ? "you" : who}${strikes ? ` (strike ${strikes})` : ""}.`,
          `${who} reached for what ${where} offered, and paid for it${strikes ? ` with strike ${strikes}` : ""}.`,
        ]),
      };
    }
    case "ITEM_GRANTED": {
      const key = typeof p.itemKey === "string" ? p.itemKey : "";
      if (!key) return null;
      const info = itemInfo(key);
      if (info.rarity === "cursed") return { mood: "peril", text: `${who} ${be(who)} handed a ${info.name}. Nobody would meet ${who === "You" ? "your" : "their"} eye.` };
      if (info.rarity === "relic") return { mood: "triumph", text: `${who} lifted the ${info.name} from its resting place.` };
      return null;
    }
    case "TRADED": {
      const key = typeof p.itemKey === "string" ? p.itemKey : "";
      const item = key ? itemInfo(key).name : "something";
      return {
        mood: "intrigue",
        text: pick(event.id, [
          `${t.name(p.fromPlayerId)} slipped a ${item} to ${t.name(p.toPlayerId)}. Whether in friendship or for a price, the log does not say.`,
          `A ${item} changed hands: ${t.name(p.fromPlayerId)} to ${t.name(p.toPlayerId)}.`,
        ]),
      };
    }
    case "HINT_BOUGHT":
      return { mood: "intrigue", text: `${who} paid a tide-rumour for a whisper about ${t.island(p.islandKey)}.` };
    case "VAULT_AWAKENED":
      return { mood: "triumph", text: `Five relics hummed as one in ${who === "You" ? "your" : `${who}'s`} hold, and the Vault woke in the north.` };
    case "TREASURE_FOUND":
      return { mood: "triumph", text: `${who} spoke the protocol and the Vault swung open. The hoard ${who === "You" ? "is yours" : `belongs to ${who}`}.` };
    case "TIME_WARNING": {
      const left = typeof p.minutesLeft === "number" ? p.minutesLeft : null;
      return { mood: "peril", text: left ? `The ship's bell rang: ${left} minute${left === 1 ? "" : "s"} of tide left.` : "The ship's bell rang a warning." };
    }
    case "TIME_UP":
      return { mood: "peril", text: "The tide turned. No more islands would be reached on this voyage." };
    case "CREW_WRECKED":
      return { mood: "peril", text: "The last sailor fell, and the sea closed over the voyage." };
    case "PLAYER_LEFT":
      return { mood: "calm", text: `${who} went ashore and did not return.` };
    default:
      return null;
  }
}

function prologueFor(room: RoomState) {
  const names = room.players.map((p) => p.username);
  const crew =
    names.length <= 1
      ? names[0] ?? "A lone sailor"
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${crew} left Port Royal aboard ${room.name}, chasing a Vault that should not exist.`;
}

function epilogueFor(t: Teller, reason: FinishReason | null) {
  const { room } = t;
  const winner = room.winnerPlayerId ? t.name(room.winnerPlayerId) : null;
  const best = [...room.scores].sort((a, b) => a.rank - b.rank)[0];
  const top = best ? `${t.name(best.playerId)} finished first in the standings with ${best.score.toLocaleString("en-US")} points.` : "";
  switch (reason) {
    case "treasure":
      return `${winner ?? "A sailor"} came home with the hoard. ${top}`.trim();
    case "wreck":
      return "No sailor came home. The Vault keeps its gold a while longer.";
    case "time":
      return `The tide ran out before the Vault was opened. ${top}`.trim();
    default:
      return "The voyage is still under sail. The rest of this story has yet to be written.";
  }
}

/** Retells a voyage from its event log. Pure: the same room always yields the same story. */
export function writeCaptainsLog(room: RoomState, meId: PlayerId | null = null): CaptainsLog {
  const t = teller(room, meId);
  const events = [...room.log].sort((a, b) => a.seq - b.seq);
  const start = Date.parse(
    events.find((e) => e.type !== "PLAYER_JOINED" && e.type !== "PLAYER_LEFT")?.createdAt ?? room.createdAt,
  );

  const firsts = new Set<string>();
  const told: (LogChapter & { weight: number })[] = [];
  for (const event of events) {
    if (SILENT.has(event.type)) continue;
    const line = tell(t, event, firsts);
    if (!line) continue;
    const at = Math.max(0, Date.parse(event.createdAt) - start);
    told.push({
      id: event.id,
      at,
      clock: formatVoyageClock(at),
      mood: line.mood,
      text: line.text,
      playerId: event.playerId,
      weight: WEIGHT[event.type] ?? 10,
    });
  }

  let kept = told;
  if (told.length > MAX_CHAPTERS) {
    const keepIds = new Set(
      [...told]
        .map((c, i) => ({ c, i }))
        .sort((a, b) => b.c.weight - a.c.weight || a.i - b.i)
        .slice(0, MAX_CHAPTERS)
        .map(({ c }) => c.id),
    );
    kept = told.filter((c) => keepIds.has(c.id));
  }

  const lastAt = told.length ? told[told.length - 1].at : 0;
  return {
    title: `The Log of ${room.name}`,
    subtitle: `${room.players.length} sailor${room.players.length === 1 ? "" : "s"} · ${formatVoyageClock(lastAt)} at sea`,
    prologue: prologueFor(room),
    chapters: kept.map((c) => ({ id: c.id, at: c.at, clock: c.clock, mood: c.mood, text: c.text, playerId: c.playerId })),
    epilogue: epilogueFor(t, room.finishReason),
  };
}

/** The whole log as plain text, for the clipboard or a chat message. */
export function captainsLogText(log: CaptainsLog) {
  return [
    log.title,
    log.subtitle,
    "",
    log.prologue,
    "",
    ...log.chapters.map((c) => `[${c.clock}] ${c.text}`),
    "",
    log.epilogue,
  ].join("\n");
}
