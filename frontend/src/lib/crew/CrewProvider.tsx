"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useNotify } from "@/components/ui/Notifications";
import { connectSocket, getSocket, onServerEvent, request, type RequestResult } from "../socket/client";
import type {
  CreateCrewPayload,
  GameActPayload,
  GameActResult,
  JoinCrewPayload,
  PlayerSnapshot,
  RoomCode,
  SeatGrant,
  VoyageSnapshot,
} from "../socket/contract";
import { describeError } from "../socket/errors";
import { profileStore, seatStore } from "../storage";
import { crewReducer, initialCrewState, type CrewState } from "./reducer";

interface CrewApi {
  state: CrewState;
  me: PlayerSnapshot | null;
  isCaptain: boolean;
  createCrew: (payload: CreateCrewPayload) => Promise<RequestResult<SeatGrant>>;
  joinCrew: (payload: JoinCrewPayload) => Promise<RequestResult<SeatGrant>>;
  rejoinCrew: (roomCode: RoomCode) => Promise<RequestResult<SeatGrant>>;
  leaveCrew: () => Promise<void>;
  setReady: (ready: boolean) => Promise<RequestResult<PlayerSnapshot>>;
  startVoyage: () => Promise<RequestResult<null>>;
  syncVoyage: () => Promise<RequestResult<VoyageSnapshot>>;
  actOnVoyage: (payload: GameActPayload) => Promise<RequestResult<GameActResult>>;
}

const CrewContext = createContext<CrewApi | null>(null);

export function CrewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(crewReducer, initialCrewState);
  const { notify } = useNotify();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const seat = useCallback((grant: SeatGrant) => {
    const me = grant.room.players.find((p) => p.id === grant.playerId);
    seatStore.set({ roomCode: grant.room.code, playerId: grant.playerId, sessionToken: grant.sessionToken });
    if (me) profileStore.set({ playerName: me.name, avatarId: me.avatarId });
    dispatch({ type: "seated", grant, at: Date.now() });
  }, []);

  const createCrew = useCallback(
    async (payload: CreateCrewPayload) => {
      const res = await request("crew:create", payload);
      if (res.ok) seat(res.data);
      return res;
    },
    [seat],
  );

  const joinCrew = useCallback(
    async (payload: JoinCrewPayload) => {
      const res = await request("crew:join", payload);
      if (res.ok) seat(res.data);
      return res;
    },
    [seat],
  );

  const rejoinCrew = useCallback(
    async (roomCode: RoomCode): Promise<RequestResult<SeatGrant>> => {
      const stored = seatStore.get();
      if (!stored || stored.roomCode !== roomCode) {
        return { ok: false, error: { code: "SESSION_EXPIRED", message: describeError("SESSION_EXPIRED") } };
      }
      const res = await request("crew:rejoin", { roomCode, sessionToken: stored.sessionToken });
      if (res.ok) seat(res.data);
      else if (res.error.code !== "OFFLINE" && res.error.code !== "TIMEOUT") seatStore.clear();
      return res;
    },
    [seat],
  );

  const leaveCrew = useCallback(async () => {
    if (stateRef.current.room) await request("crew:leave", {});
    seatStore.clear();
    dispatch({ type: "reset" });
  }, []);

  const setReady = useCallback((ready: boolean) => request("player:ready", { ready }), []);
  const startVoyage = useCallback(() => request("game:start", {}), []);

  useEffect(() => {
    connectSocket();
    const at = () => Date.now();

    const unsubscribers = [
      onServerEvent("room:state", (room) => dispatch({ type: "room-state", room })),
      onServerEvent("room:player-joined", ({ player }) => dispatch({ type: "player-joined", player, at: at() })),
      onServerEvent("room:player-left", ({ playerId, name, reason }) => {
        if (playerId === stateRef.current.playerId) {
          seatStore.clear();
          dispatch({ type: "reset" });
          notify({
            tone: "danger",
            title: reason === "kicked" ? "Cast overboard" : "Left the ship",
            message: reason === "kicked" ? "The captain removed you from the crew." : undefined,
          });
          return;
        }
        dispatch({ type: "player-left", playerId, name, reason, at: at() });
      }),
      onServerEvent("room:player-updated", ({ player }) => dispatch({ type: "player-updated", player, at: at() })),
      onServerEvent("room:captain-changed", ({ captainId }) => {
        dispatch({ type: "captain-changed", captainId, at: at() });
        if (captainId === stateRef.current.playerId) {
          notify({ tone: "warning", title: "You hold the helm", message: "The crew now answers to you, Captain." });
        }
      }),
      onServerEvent("game:starting", ({ startsAt, seconds }) =>
        dispatch({ type: "voyage-starting", startsAt, seconds, at: at() }),
      ),
      onServerEvent("game:started", () => dispatch({ type: "voyage-started", at: at() })),
      onServerEvent("server:notice", ({ level, message }) =>
        notify({ tone: level, title: level === "info" ? "Word from the harbour" : "Harbour warning", message }),
      ),
    ];

    const socket = getSocket();
    let hasConnectedBefore = socket.connected;
    const onConnect = async () => {
      const current = stateRef.current.room;
      if (hasConnectedBefore && current) {
        const res = await rejoinCrew(current.code);
        if (!res.ok) {
          dispatch({ type: "reset" });
          notify({ tone: "danger", title: "Lost at sea", message: describeError(res.error.code) });
        } else {
          notify({ tone: "success", title: "Back aboard", message: "The connection to your ship was restored." });
        }
      }
      hasConnectedBefore = true;
    };
    socket.on("connect", onConnect);

    return () => {
      unsubscribers.forEach((off) => off());
      socket.off("connect", onConnect);
    };
  }, [notify, rejoinCrew]);

  const me = useMemo(
    () => state.room?.players.find((p) => p.id === state.playerId) ?? null,
    [state.room, state.playerId],
  );

  const api = useMemo<CrewApi>(
    () => ({
      state,
      me,
      isCaptain: !!me && state.room?.captainId === me.id,
      createCrew,
      joinCrew,
      rejoinCrew,
      leaveCrew,
      setReady,
      startVoyage,
    }),
    [state, me, createCrew, joinCrew, rejoinCrew, leaveCrew, setReady, startVoyage],
  );

  return <CrewContext.Provider value={api}>{children}</CrewContext.Provider>;
}

export function useCrew() {
  const ctx = useContext(CrewContext);
  if (!ctx) throw new Error("useCrew must be used inside <CrewProvider>");
  return ctx;
}
