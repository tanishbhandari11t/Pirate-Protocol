import { Prisma } from '@prisma/client';
import { asRecord } from '../common/game-events';

export type AdventurePhase = 'lobby' | 'countdown' | 'voyage' | 'finished';

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
  displayName: string;
  avatarId: string | null;
  isHost: boolean;
  isReady: boolean;
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

export interface ActiveClue {
  id: string;
  text: string;
  islandKey?: string;
}

export interface VaultSummary {
  ready: boolean;
  missingRelics: string[];
}

export interface SharedRoomState {
  code: string;
  name: string;
  status: 'LOBBY' | 'COUNTDOWN' | 'ACTIVE' | 'FINISHED';
  phase: AdventurePhase;
  maxPlayers: number;
  hostId: string;
  createdAt: string;
  countdownEndsAt: string | null;
  voyageStartedAt: string | null;
  players: PublicPlayer[];
  islands: PublicIsland[];
  discoveredIslandKeys: string[];
  exploredIslandKeys: string[];
  activeClues: ActiveClue[];
  scores: { playerId: string; points: number }[];
  destinations: string[];
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
  vault: VaultSummary;
}

export interface LobbyPlayerSnapshot {
  id: string;
  name: string;
  avatarId: string | null;
  isCaptain: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: string;
}

export interface LobbyRoomSnapshot {
  code: string;
  crewName: string;
  phase: 'lobby' | 'countdown' | 'in-game' | 'finished';
  captainId: string;
  players: LobbyPlayerSnapshot[];
  maxPlayers: number;
  minPlayers: number;
  createdAt: string;
  countdownEndsAt: string | null;
}

export interface PresenceChanged {
  code: string;
  playerId: string;
  userId: string;
  online: boolean;
  lastSeenAt: string;
}

export function roomPhaseFromStatus(status: string): AdventurePhase {
  if (status === 'LOBBY') return 'lobby';
  if (status === 'COUNTDOWN') return 'countdown';
  if (status === 'FINISHED') return 'finished';
  return 'voyage';
}

export function lobbyPhaseFromStatus(status: string): LobbyRoomSnapshot['phase'] {
  if (status === 'LOBBY') return 'lobby';
  if (status === 'COUNTDOWN') return 'countdown';
  if (status === 'FINISHED') return 'finished';
  return 'in-game';
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
