import { Prisma } from '@prisma/client';
import { asRecord } from '../common/game-events';

export interface InventoryView {
  itemKey: string;
  name: string;
  description: string;
  quantity: number;
}

export interface PublicPlayer {
  id: string;
  userId: string;
  username: string;
  isHost: boolean;
  isOnline: boolean;
  isEliminated: boolean;
  strikes: number;
  lastSeenAt: string;
  currentIslandKey: string | null;
}

export interface PublicPuzzle {
  id: string;
  key: string;
  prompt: string;
  cipher: string;
  order: number;
}

export interface PublicIsland {
  id: string;
  key: string;
  name: string;
  description: string;
  x: number;
  y: number;
  order: number;
  kind: 'NORMAL' | 'TRAP' | 'TREASURE';
  puzzles: PublicPuzzle[];
}

export interface SharedRoomState {
  code: string;
  name: string;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  maxPlayers: number;
  hostId: string;
  createdAt: string;
  players: PublicPlayer[];
  islands: PublicIsland[];
  progress: { playerId: string; puzzleKey: string }[];
  log: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    playerId: string | null;
    createdAt: string;
  }[];
  winnerPlayerId: string | null;
}

export interface RoomState extends SharedRoomState {
  you: InventoryView[];
}

export interface PresenceChanged {
  code: string;
  playerId: string;
  userId: string;
  online: boolean;
  lastSeenAt: string;
}

export function toInventoryView(row: {
  itemKey: string;
  quantity: number;
  metadata: Prisma.JsonValue;
}): InventoryView {
  const meta = asRecord(row.metadata);
  return {
    itemKey: row.itemKey,
    name: typeof meta.name === 'string' ? meta.name : row.itemKey,
    description: typeof meta.description === 'string' ? meta.description : '',
    quantity: row.quantity,
  };
}

export function toPublicPuzzle(puzzle: PublicPuzzle): PublicPuzzle {
  return {
    id: puzzle.id,
    key: puzzle.key,
    prompt: puzzle.prompt,
    cipher: puzzle.cipher,
    order: puzzle.order,
  };
}
