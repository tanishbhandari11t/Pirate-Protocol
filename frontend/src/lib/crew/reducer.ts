import { bareShipName } from "../names";
import type {
  LeaveReason,
  PlayerId,
  PlayerSnapshot,
  RoomSnapshot,
  SeatGrant,
  VoyageSnapshot,
} from "../socket/contract";

export type LogTone = "info" | "join" | "leave" | "ready" | "captain" | "voyage";

export interface LogEntry {
  id: number;
  at: number;
  tone: LogTone;
  text: string;
}

export interface CrewState {
  room: RoomSnapshot | null;
  playerId: PlayerId | null;
  countdown: { startsAt: number; seconds: number } | null;
  voyageStarted: boolean;
  voyage: VoyageSnapshot | null;
  log: LogEntry[];
  logSeq: number;
}

export const initialCrewState: CrewState = {
  room: null,
  playerId: null,
  countdown: null,
  voyageStarted: false,
  voyage: null,
  log: [],
  logSeq: 0,
};

export type CrewAction =
  | { type: "seated"; grant: SeatGrant; at: number }
  | { type: "room-state"; room: RoomSnapshot }
  | { type: "player-joined"; player: PlayerSnapshot; at: number }
  | { type: "player-left"; playerId: PlayerId; name: string; reason: LeaveReason; at: number }
  | { type: "player-updated"; player: PlayerSnapshot; at: number }
  | { type: "captain-changed"; captainId: PlayerId; at: number }
  | { type: "voyage-starting"; startsAt: number; seconds: number; at: number }
  | { type: "voyage-started"; at: number }
  | { type: "voyage-state"; voyage: VoyageSnapshot }
  | { type: "reset" };

const LOG_LIMIT = 40;

function appendLog(state: CrewState, at: number, tone: LogTone, text: string): CrewState {
  const logSeq = state.logSeq + 1;
  return { ...state, logSeq, log: [...state.log, { id: logSeq, at, tone, text }].slice(-LOG_LIMIT) };
}

function upsertPlayer(room: RoomSnapshot, player: PlayerSnapshot): RoomSnapshot {
  const exists = room.players.some((p) => p.id === player.id);
  return {
    ...room,
    players: exists
      ? room.players.map((p) => (p.id === player.id ? player : p))
      : [...room.players, player],
  };
}

export function crewReducer(state: CrewState, action: CrewAction): CrewState {
  switch (action.type) {
    case "seated": {
      const { room, playerId } = action.grant;
      const me = room.players.find((p) => p.id === playerId);
      const sameRoom = state.room?.code === room.code;
      const underway = room.phase === "in-game" || room.phase === "finished";
      const base: CrewState = {
        ...initialCrewState,
        room,
        playerId,
        voyage: sameRoom ? state.voyage : null,
        voyageStarted: underway || (sameRoom && state.voyageStarted),
        log: sameRoom ? state.log : [],
        logSeq: state.logSeq,
      };
      return appendLog(base, action.at, "join", `${me?.name ?? "You"} came aboard the ${bareShipName(room.crewName)}.`);
    }

    case "room-state":
      if (!state.room || action.room.code !== state.room.code) return state;
      return {
        ...state,
        room: action.room,
        countdown: action.room.phase === "lobby" ? null : state.countdown,
      };

    case "player-joined": {
      if (!state.room) return state;
      const next = { ...state, room: upsertPlayer(state.room, action.player) };
      return appendLog(next, action.at, "join", `${action.player.name} climbed aboard.`);
    }

    case "player-left": {
      if (!state.room) return state;
      const room = { ...state.room, players: state.room.players.filter((p) => p.id !== action.playerId) };
      const verb =
        action.reason === "kicked"
          ? "was cast overboard"
          : action.reason === "disconnected"
            ? "vanished into the fog"
            : "went ashore";
      return appendLog({ ...state, room }, action.at, "leave", `${action.name} ${verb}.`);
    }

    case "player-updated": {
      if (!state.room) return state;
      const previous = state.room.players.find((p) => p.id === action.player.id);
      const next = { ...state, room: upsertPlayer(state.room, action.player) };
      if (previous && previous.isReady !== action.player.isReady) {
        return appendLog(
          next,
          action.at,
          "ready",
          action.player.isReady
            ? `${action.player.name} is ready to weigh anchor.`
            : `${action.player.name} needs a moment more.`,
        );
      }
      if (previous && previous.isConnected !== action.player.isConnected) {
        return appendLog(
          next,
          action.at,
          action.player.isConnected ? "join" : "leave",
          action.player.isConnected
            ? `${action.player.name} emerged from the fog.`
            : `${action.player.name} lost sight of the ship.`,
        );
      }
      return next;
    }

    case "captain-changed": {
      if (!state.room) return state;
      const room: RoomSnapshot = {
        ...state.room,
        captainId: action.captainId,
        players: state.room.players.map((p) => ({ ...p, isCaptain: p.id === action.captainId })),
      };
      const captain = room.players.find((p) => p.id === action.captainId);
      return appendLog({ ...state, room }, action.at, "captain", `${captain?.name ?? "A new sailor"} now holds the helm.`);
    }

    case "voyage-starting": {
      const next: CrewState = {
        ...state,
        countdown: { startsAt: action.startsAt, seconds: action.seconds },
        room: state.room ? { ...state.room, phase: "starting" } : state.room,
      };
      return appendLog(next, action.at, "voyage", "The captain orders: weigh anchor!");
    }

    case "voyage-started":
      return {
        ...state,
        voyageStarted: true,
        countdown: null,
        room: state.room ? { ...state.room, phase: "in-game" } : state.room,
      };

    case "voyage-state":
      if (state.room && action.voyage.roomCode !== state.room.code) return state;
      return { ...state, voyage: action.voyage, voyageStarted: true };

    case "reset":
      return { ...initialCrewState, logSeq: state.logSeq };

    default:
      return state;
  }
}
