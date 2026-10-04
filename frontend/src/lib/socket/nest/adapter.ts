import type { Socket } from "socket.io-client";
import type { RequestResult } from "../client";
import {
  START_ISLAND_KEY,
  type ClientRequestName,
  type RequestPayload,
  type ResponseData,
  type SeatGrant,
  type ServerEventName,
  type ServerEvents,
} from "../contract";
import { describeError } from "../errors";
import {
  NestMirror,
  errorCodeFor,
  staleCrewCode,
  toNestUsername,
  userIdFromToken,
  type MirrorChange,
} from "./translate";
import {
  NestClientEvents,
  NestServerEvents,
  type NestEvent,
  type NestGuestSession,
  type NestPresence,
  type NestRoomState,
} from "./wire";

const REQUEST_TIMEOUT_MS = 8000;
/** Lets the server's own `game:event`s for a change land in the log before the derived ones. */
const DERIVED_EVENT_DELAY_MS = 150;

type Result<T> = RequestResult<T>;
type Handler = (payload: never) => void;

export interface NestBridgeOptions {
  /** The shared socket, created with an `auth` callback that reads `token()`. */
  socket: Socket;
  serverUrl: string;
  /** Connects the socket if needed and resolves once it is connected, or `false` on timeout. */
  waitForConnection: () => Promise<boolean>;
}

export interface NestBridge {
  token(): string | null;
  request<K extends ClientRequestName>(event: K, payload: RequestPayload<K>): Promise<Result<ResponseData<K>>>;
  on<K extends ServerEventName>(event: K, handler: (payload: ServerEvents[K]) => void): () => void;
}

function fail<T>(code: Parameters<typeof describeError>[0], message?: string): Result<T> {
  return { ok: false, error: { code, message: message ?? describeError(code) } };
}

function failFrom<T>(message: string | undefined): Result<T> {
  const code = errorCodeFor(message);
  return { ok: false, error: { code, message: message ?? describeError(code) } };
}

/**
 * Speaks the frontend protocol (`contract.ts`) on top of the NestJS game server.
 *
 * Requests the server has no equivalent for answer `UNSUPPORTED`; the UI hides them through
 * `CAPABILITIES`. Outcomes (solved, trapped, who won) are read from the state the server
 * returns, never decided here.
 */
export function createNestBridge({ socket, serverUrl, waitForConnection }: NestBridgeOptions): NestBridge {
  const listeners = new Map<string, Set<Handler>>();
  let session: { username: string; userId: string; token: string } | null = null;
  let mirror: NestMirror | null = null;
  /** The crew code whose first `room:state` should start a mirror; `*` while creating a crew. */
  let expecting: string | null = null;
  /** Ignore the final state the server sends to a sailor who is leaving. */
  let leaving: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function emit<K extends ServerEventName>(event: K, payload: ServerEvents[K]) {
    listeners.get(event)?.forEach((handler) => (handler as (p: ServerEvents[K]) => void)(payload));
  }

  /* ---------------- server → client ---------------- */

  function publish(change: MirrorChange) {
    const code = change.push.code;
    change.left.forEach(({ playerId, name }) => emit("room:player-left", { playerId, name, reason: "left" }));
    change.joined.forEach((player) => emit("room:player-joined", { player }));
    change.updated.forEach((player) => emit("room:player-updated", { player }));
    if (change.captainId) emit("room:captain-changed", { captainId: change.captainId });
    if (change.started) {
      emit("game:started", { roomCode: code, startedAt: change.push.voyage?.startedAt ?? Date.now(), endsAt: null });
    }
    if (change.finished) {
      emit("game:finished", {
        roomCode: code,
        winnerPlayerId: change.push.voyage?.winnerPlayerId ?? null,
        finishedAt: change.push.voyage?.finishedAt ?? Date.now(),
        reason: "treasure",
        scores: [],
      });
    }
    emit("room:state", change.push);
    if (change.vaultAwakened) {
      const current = mirror;
      setTimeout(() => {
        if (mirror !== current || !current) return;
        emit("game:event", { ...current.vaultEvent(), roomCode: code });
      }, DERIVED_EVENT_DELAY_MS);
    }
  }

  socket.on(NestServerEvents.STATE, (state: NestRoomState) => {
    if (state.code === leaving) return;
    if (!mirror || mirror.code !== state.code) {
      if (!session || (expecting !== "*" && expecting !== state.code)) return;
      mirror = new NestMirror(state.code, session.userId);
    }
    publish(mirror.ingest(state));
  });

  socket.on(NestServerEvents.EVENT, (event: NestEvent & { code: string }) => {
    if (!mirror || event.code !== mirror.code) return;
    emit("game:event", { ...mirror.event(event), roomCode: event.code });
  });

  socket.on(NestServerEvents.PRESENCE, (presence: NestPresence) => {
    if (!mirror || presence.code !== mirror.code) return;
    const player = mirror.presence(presence);
    if (player) emit("room:player-updated", { player });
  });

  /* ---------------- client → server ---------------- */

  /** Emits one server event and waits for its ack, or for the error the server sends instead. */
  function call<T>(event: string, payload: unknown): Promise<Result<T>> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: Result<T>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off(NestServerEvents.ERROR, onError);
        socket.off("disconnect", onDisconnect);
        resolve(result);
      };
      const onError = (error: { message?: unknown }) =>
        finish(failFrom(typeof error?.message === "string" ? error.message : undefined));
      const onDisconnect = () => finish(fail("OFFLINE"));
      const timer = setTimeout(() => finish(fail("TIMEOUT")), REQUEST_TIMEOUT_MS);

      socket.on(NestServerEvents.ERROR, onError);
      socket.on("disconnect", onDisconnect);
      socket.emit(event, payload, (data: T) => finish({ ok: true, data }));
    });
  }

  function adoptToken(token: string): boolean {
    const userId = userIdFromToken(token);
    if (!userId) return false;
    if (session?.token === token) return true;
    const reconnect = socket.connected || socket.active;
    session = { username: session?.userId === userId ? session.username : "", userId, token };
    mirror = null;
    if (reconnect) socket.disconnect();
    return true;
  }

  async function signIn(playerName: string): Promise<Result<null>> {
    const username = toNestUsername(playerName);
    if (session?.username === username) return { ok: true, data: null };
    let response: Response;
    try {
      response = await fetch(`${serverUrl}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    } catch {
      return fail("OFFLINE");
    }
    const body = (await response.json().catch(() => null)) as
      | (NestGuestSession & { message?: string | string[] })
      | null;
    if (!response.ok || !body?.token) {
      const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
      return response.status === 400 ? fail("INVALID_PAYLOAD", message) : failFrom(message);
    }
    adoptToken(body.token);
    session = { username, userId: body.user.id, token: body.token };
    return { ok: true, data: null };
  }

  async function connected<T>(): Promise<Result<T> | null> {
    return (await waitForConnection()) ? null : fail<T>("OFFLINE");
  }

  function seatFrom(state: NestRoomState): Result<SeatGrant> {
    if (!session) return fail("SESSION_EXPIRED");
    if (!mirror || mirror.code !== state.code) {
      mirror = new NestMirror(state.code, session.userId);
      mirror.ingest(state);
    }
    const playerId = mirror.playerId;
    if (!playerId) return fail("NOT_IN_ROOM");
    const current = mirror;
    // The seat lands before the reducer accepts pushes for this ship, so resend the state once it has.
    setTimeout(() => {
      if (mirror === current) emit("room:state", current.toPush());
    }, 0);
    return { ok: true, data: { room: current.toPush(), playerId, sessionToken: session.token, chat: [] } };
  }

  /** Boards a ship, abandoning a berth the server still holds for this name on another one. */
  async function board(event: string, payload: Record<string, unknown>, code: string): Promise<Result<SeatGrant>> {
    expecting = code;
    leaving = null;
    let res = await call<NestRoomState>(event, payload);
    const stale = !res.ok && res.error.code === "IN_ANOTHER_CREW" ? staleCrewCode(res.error.message) : null;
    if (stale) {
      await call(NestClientEvents.LEAVE, { code: stale });
      res = await call<NestRoomState>(event, payload);
    }
    expecting = null;
    return res.ok ? seatFrom(res.data) : res;
  }

  async function handle(event: ClientRequestName, payload: unknown): Promise<Result<unknown>> {
    switch (event) {
      case "crew:create": {
        const { playerName, crewName } = payload as RequestPayload<"crew:create">;
        const signed = await signIn(playerName);
        if (!signed.ok) return signed;
        const offline = await connected<SeatGrant>();
        if (offline) return offline;
        mirror = null;
        return board(NestClientEvents.CREATE, { name: crewName }, "*");
      }

      case "crew:join": {
        const { playerName, roomCode } = payload as RequestPayload<"crew:join">;
        const signed = await signIn(playerName);
        if (!signed.ok) return signed;
        const offline = await connected<SeatGrant>();
        if (offline) return offline;
        return board(NestClientEvents.JOIN, { code: roomCode }, roomCode);
      }

      case "crew:rejoin": {
        const { roomCode, sessionToken } = payload as RequestPayload<"crew:rejoin">;
        if (!adoptToken(sessionToken)) return fail("SESSION_EXPIRED");
        const offline = await connected<SeatGrant>();
        if (offline) return offline;
        return board(NestClientEvents.JOIN, { code: roomCode }, roomCode);
      }

      case "crew:leave": {
        const code = mirror?.code;
        if (!code) return { ok: true, data: null };
        leaving = code;
        mirror = null;
        const res = await call(NestClientEvents.LEAVE, { code });
        return res.ok ? { ok: true, data: null } : res;
      }

      case "game:start": {
        // The server weighs anchor on the crew's first move, so the captain's order is a move to where they stand.
        const me = mirror?.me();
        if (!mirror || !me) return fail("NOT_IN_ROOM");
        const res = await call(NestClientEvents.MOVE, {
          code: mirror.code,
          islandKey: me.currentIslandKey ?? START_ISLAND_KEY,
        });
        return res.ok ? { ok: true, data: null } : res;
      }

      case "map:move": {
        const { islandKey } = payload as RequestPayload<"map:move">;
        if (!mirror) return fail("NOT_IN_ROOM");
        const discovered = !mirror.isDiscovered(islandKey);
        const res = await call(NestClientEvents.MOVE, { code: mirror.code, islandKey });
        return res.ok ? { ok: true, data: { islandKey, discovered } } : res;
      }

      case "puzzle:submit": {
        const { puzzleKey, answer } = payload as RequestPayload<"puzzle:submit">;
        const before = mirror?.state;
        if (!mirror || !before) return fail("NOT_IN_ROOM");
        const current = mirror;
        const res = await call<NestRoomState>(NestClientEvents.ANSWER, { code: current.code, puzzleKey, answer });
        return res.ok ? { ok: true, data: current.verdict(before, res.data, puzzleKey) } : res;
      }

      case "trade:offer": {
        const { toPlayerId, itemKey } = payload as RequestPayload<"trade:offer">;
        const before = mirror?.state;
        if (!mirror || !before) return fail("NOT_IN_ROOM");
        const quantity = before.you.find((i) => i.itemKey === itemKey)?.quantity ?? 1;
        const res = await call(NestClientEvents.TRADE, { code: mirror.code, toPlayerId, itemKey });
        return res.ok ? { ok: true, data: { itemKey, quantity, toPlayerId } } : res;
      }

      case "voyage:sync": {
        const { sinceSeq } = payload as RequestPayload<"voyage:sync">;
        if (!mirror) return fail("NOT_SAILING");
        return { ok: true, data: { ...mirror.eventsSince(sinceSeq), complete: false } };
      }

      default:
        return fail("UNSUPPORTED");
    }
  }

  return {
    token: () => session?.token ?? null,

    request<K extends ClientRequestName>(event: K, payload: RequestPayload<K>) {
      const run = queue.then(() => handle(event, payload));
      queue = run.catch(() => undefined);
      return run.catch(() => fail("INTERNAL")) as Promise<Result<ResponseData<K>>>;
    },

    on<K extends ServerEventName>(event: K, handler: (payload: ServerEvents[K]) => void) {
      const set = listeners.get(event) ?? new Set<Handler>();
      set.add(handler as Handler);
      listeners.set(event, set);
      return () => {
        set.delete(handler as Handler);
      };
    },
  };
}
