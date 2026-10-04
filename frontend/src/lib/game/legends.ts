"use client";

import { useSyncExternalStore } from "react";
import type { AvatarId, FinishReason, PlayerId, RoomState } from "../socket/contract";
import { voyageStartedAt } from "./selectors";

/**
 * The Hall of Legends: finished voyages this device took part in, distilled from the server's own
 * record (event log, scores, finish reason). Nothing here is invented; a legend is only written
 * once the server has declared the voyage over.
 */

export interface LegendPoint {
  x: number;
  y: number;
}

export interface LegendSailor {
  id: PlayerId;
  name: string;
  avatarId: AvatarId;
  won: boolean;
  wrecked: boolean;
  /** Where this sailor actually sailed, island to island, on the 0–100 grid. */
  route: LegendPoint[];
}

export interface Legend {
  id: string;
  crewName: string;
  finishedAt: number;
  durationMs: number;
  reason: FinishReason | null;
  winnerName: string | null;
  meName: string | null;
  islandsCharted: number;
  islandsTotal: number;
  riddlesSolved: number;
  sailors: LegendSailor[];
  /** Islands the crew put on the chart, and who sighted each first. */
  discoveries: { islandName: string; by: string; at: LegendPoint }[];
  /** Where sailors were claimed by the sea. */
  wrecks: { name: string; islandName: string; at: LegendPoint }[];
}

export const MAX_LEGENDS = 24;
const KEY = "pp:legends";

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** Builds a legend from a finished voyage, or null while the voyage is still at sea. */
export function legendFromRoom(room: RoomState, meId: PlayerId | null): Legend | null {
  if (!room.finishReason) return null;
  const islandAt = (key: unknown) => (typeof key === "string" ? room.islands.find((i) => i.key === key) : undefined);
  const nameOf = (id: unknown) => room.players.find((p) => p.id === id)?.username ?? "A departed sailor";
  const last = room.log[room.log.length - 1];
  const finishedAt = last ? time(last.createdAt) : Date.now();

  const routes = new Map<PlayerId, LegendPoint[]>();
  const wrecks: Legend["wrecks"] = [];
  const discoveries: Legend["discoveries"] = [];
  let riddlesSolved = 0;

  for (const event of room.log) {
    const p = event.payload as Record<string, unknown>;
    if (event.type === "MOVED" && event.playerId) {
      const route = routes.get(event.playerId) ?? [];
      const from = islandAt(p.fromIslandKey);
      if (route.length === 0 && from) route.push({ x: from.x, y: from.y });
      const to = islandAt(p.islandKey);
      if (to) route.push({ x: to.x, y: to.y });
      routes.set(event.playerId, route);
    } else if (event.type === "ISLAND_DISCOVERED") {
      const island = islandAt(p.islandKey);
      if (island) discoveries.push({ islandName: island.name, by: nameOf(event.playerId), at: { x: island.x, y: island.y } });
    } else if (event.type === "TRAP_TRIGGERED" && p.eliminated === true) {
      const island = islandAt(p.islandKey) ?? room.islands.find((i) => i.puzzles.some((z) => z.key === p.puzzleKey));
      if (island) wrecks.push({ name: nameOf(event.playerId), islandName: island.name, at: { x: island.x, y: island.y } });
    } else if (event.type === "PUZZLE_SOLVED") {
      riddlesSolved += 1;
    }
  }

  const winner = room.players.find((p) => p.id === room.winnerPlayerId);
  return {
    id: `${room.code}-${room.createdAt}`,
    crewName: room.name,
    finishedAt,
    durationMs: Math.max(0, finishedAt - voyageStartedAt(room)),
    reason: room.finishReason,
    winnerName: winner?.username ?? null,
    meName: room.players.find((p) => p.id === meId)?.username ?? null,
    islandsCharted: room.discovered.length,
    islandsTotal: room.islands.length,
    riddlesSolved,
    sailors: room.players.map((p) => ({
      id: p.id,
      name: p.username,
      avatarId: p.avatarId,
      won: p.id === room.winnerPlayerId,
      wrecked: p.isEliminated,
      route: routes.get(p.id) ?? [],
    })),
    discoveries,
    wrecks,
  };
}

function isLegend(v: unknown): v is Legend {
  if (!v || typeof v !== "object") return false;
  const l = v as Record<string, unknown>;
  return typeof l.id === "string" && typeof l.crewName === "string" && typeof l.finishedAt === "number" && Array.isArray(l.sailors);
}

export function parseLegends(raw: string | null): Legend[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isLegend).slice(0, MAX_LEGENDS) : [];
  } catch {
    return [];
  }
}

const EMPTY: Legend[] = [];
let cache: { raw: string | null; list: Legend[] } = { raw: null, list: EMPTY };
const listeners = new Set<() => void>();

function read(): Legend[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) cache = { raw, list: parseLegends(raw) };
  return cache.list;
}

function write(list: Legend[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the legend simply isn't kept */
  }
  listeners.forEach((l) => l());
}

export const legendStore = {
  all: read,
  /** Adds or refreshes a legend; newest first. */
  add(legend: Legend) {
    write([legend, ...read().filter((l) => l.id !== legend.id)].slice(0, MAX_LEGENDS));
  },
  clear() {
    write([]);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === KEY && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function useLegends() {
  return useSyncExternalStore(legendStore.subscribe, read, () => EMPTY);
}
