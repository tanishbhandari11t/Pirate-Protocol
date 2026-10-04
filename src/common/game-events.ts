import { Prisma } from '@prisma/client';

export const GameEventType = {
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  MOVED: 'MOVED',
  PUZZLE_SOLVED: 'PUZZLE_SOLVED',
  PUZZLE_FAILED: 'PUZZLE_FAILED',
  TRAP_TRIGGERED: 'TRAP_TRIGGERED',
  ITEM_GRANTED: 'ITEM_GRANTED',
  TRADED: 'TRADED',
  TREASURE_FOUND: 'TREASURE_FOUND',
  VOYAGE_STARTED: 'VOYAGE_STARTED',
  ISLAND_DISCOVERED: 'ISLAND_DISCOVERED',
  ISLAND_EXPLORED: 'ISLAND_EXPLORED',
  CLUE_FOUND: 'CLUE_FOUND',
  ADVENTURE_NOTICE: 'ADVENTURE_NOTICE',
} as const;

export type GameEventTypeName = (typeof GameEventType)[keyof typeof GameEventType];

export interface GameEventView {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  playerId: string | null;
  createdAt: string;
}

export function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

export function toEventView(row: {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  playerId: string | null;
  createdAt: Date;
}): GameEventView {
  return {
    id: row.id,
    type: row.type,
    payload: asRecord(row.payload),
    playerId: row.playerId,
    createdAt: row.createdAt.toISOString(),
  };
}
