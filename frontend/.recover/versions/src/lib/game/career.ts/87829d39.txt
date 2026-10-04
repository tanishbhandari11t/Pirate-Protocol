import { useMemo, useSyncExternalStore } from "react";
import { REQUIRED_RELICS, type FinishReason, type PlayerId, type RoomState } from "../socket/contract";
import { createStorageStore } from "../storage";
import { ACHIEVEMENTS, achievementsFor } from "./achievements";
import { relicsOf, solvedKeys } from "./selectors";

/**
 * A sailor's record across voyages, kept on their own device. Every entry is copied from a
 * finished voyage exactly as the server reported it — wins, solves, strikes and honours are
 * never estimated here. Cosmetic unlocks are read from these totals.
 */
export interface VoyageRecord {
  /** `${code}:${createdAt}` — one entry per voyage even if the results screen is opened twice. */
  key: string;
  crewName: string;
  /** Epoch ms when the record was written. */
  recordedAt: number;
  finishReason: FinishReason | null;
  won: boolean;
  solved: number;
  relics: number;
  strikes: number;
  eliminated: boolean;
  honours: string[];
}

export interface Career {
  voyages: VoyageRecord[];
}

export interface CareerTotals {
  voyages: number;
  wins: number;
  solved: number;
  relics: number;
  /** Voyages finished with every relic in hand. */
  fullHolds: number;
  /** Voyages finished without a single strike. */
  spotless: number;
  honours: ReadonlySet<string>;
}

/** Older voyages fall off once the log grows past this. Totals only need the recent past. */
export const CAREER_LIMIT = 60;

export const EMPTY_CAREER: Career = { voyages: [] };

export function voyageKey(room: Pick<RoomState, "code" | "createdAt">) {
  return `${room.code}:${room.createdAt}`;
}

/** Reads one sailor's part in a finished voyage, or `null` while the voyage is still at sea. */
export function voyageRecord(room: RoomState, playerId: PlayerId, now = Date.now()): VoyageRecord | null {
  if (room.status !== "FINISHED") return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  return {
    key: voyageKey(room),
    crewName: room.name,
    recordedAt: now,
    finishReason: room.finishReason,
    won: room.winnerPlayerId === playerId,
    solved: solvedKeys(room, playerId).size,
    relics: relicsOf(room, playerId).length,
    strikes: player.strikes,
    eliminated: player.isEliminated,
    honours: achievementsFor(room, playerId).map((a) => a.id),
  };
}

/** Adds a voyage to the log, newest first, ignoring one that is already recorded. */
export function withVoyage(career: Career, record: VoyageRecord): Career {
  if (career.voyages.some((v) => v.key === record.key)) return career;
  return { voyages: [record, ...career.voyages].slice(0, CAREER_LIMIT) };
}

export function careerTotals(career: Career): CareerTotals {
  const honours = new Set<string>();
  let wins = 0;
  let solved = 0;
  let relics = 0;
  let fullHolds = 0;
  let spotless = 0;
  for (const v of career.voyages) {
    if (v.won) wins += 1;
    solved += v.solved;
    relics += v.relics;
    if (v.relics >= REQUIRED_RELICS.length) fullHolds += 1;
    if (v.strikes === 0 && v.solved > 0) spotless += 1;
    v.honours.forEach((h) => honours.add(h));
  }
  return { voyages: career.voyages.length, wins, solved, relics, fullHolds, spotless, honours };
}

/** True once every honour in the book has been earned at least once. */
export function isLegend(totals: CareerTotals) {
  return ACHIEVEMENTS.every((a) => totals.honours.has(a.id));
}

/** Keeps only entries that look like records this module wrote; storage can be edited by hand. */
export function parseCareer(value: unknown): Career {
  if (!value || typeof value !== "object" || !Array.isArray((value as Career).voyages)) return EMPTY_CAREER;
  const voyages = (value as Career).voyages.filter(
    (v): v is VoyageRecord =>
      !!v &&
      typeof v.key === "string" &&
      typeof v.won === "boolean" &&
      Number.isFinite(v.solved) &&
      Number.isFinite(v.relics) &&
      Number.isFinite(v.strikes) &&
      Array.isArray(v.honours),
  );
  return { voyages: voyages.slice(0, CAREER_LIMIT) };
}

const careerStore = createStorageStore<Career>("local", "pp:career");

export function loadCareer(): Career {
  return parseCareer(careerStore.get());
}

/**
 * Writes a finished voyage into the career once. Returns the totals before and after, so the
 * results screen can say what this voyage unlocked, or `null` if nothing changed.
 */
export function recordVoyage(room: RoomState, playerId: PlayerId): { before: CareerTotals; after: CareerTotals } | null {
  const record = voyageRecord(room, playerId);
  if (!record) return null;
  const career = loadCareer();
  const next = withVoyage(career, record);
  if (next === career) return null;
  careerStore.set(next);
  return { before: careerTotals(career), after: careerTotals(next) };
}

export function useCareer(): Career {
  const raw = useSyncExternalStore(careerStore.subscribe, careerStore.getSnapshot, careerStore.getServerSnapshot);
  return useMemo(() => parseCareer(raw), [raw]);
}
