import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVATAR_IDS, type ServerEventName, type ServerEvents } from "../contract";
import { createNestBridge, type NestBridge } from "./adapter";
import type { NestRoomState } from "./wire";
import { ALL_RELICS, ANNE, CODE, JACK, MARY, event, item, player, state, tokenFor } from "@/test/nest-fixtures";

const SERVER_URL = "http://harbour.test";

type Listener = (...args: unknown[]) => void;
type Ack = ((data: unknown) => void) | undefined;
type ServerHandler = (event: string, payload: Record<string, unknown>, ack: Ack) => void;

/** Just enough of a Socket.IO client for the bridge: listeners, emits with acks, and a server to answer them. */
class FakeSocket {
  connected = false;
  active = false;
  readonly sent: { event: string; payload: Record<string, unknown> }[] = [];
  server: ServerHandler = () => {};
  readonly disconnects = vi.fn();
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, payload: Record<string, unknown>, ack?: Ack) {
    this.sent.push({ event, payload });
    this.server(event, payload, ack);
    return this;
  }

  disconnect() {
    this.disconnects();
    this.connected = false;
    this.active = false;
    this.fire("disconnect", "io client disconnect");
    return this;
  }

  /** Delivers a push from the server. */
  fire(event: string, ...args: unknown[]) {
    [...(this.listeners.get(event) ?? [])].forEach((listener) => listener(...args));
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }

  /** The server's success path: the state goes out to the room, then comes back as the ack. */
  reply(ack: Ack, next: NestRoomState) {
    this.fire("room:state", next);
    ack?.(next);
  }

  /** The server's failure path: no ack, a `game:error`, then Nest's own `exception`. */
  refuse(message: string) {
    this.fire("game:error", { message });
    this.fire("exception", { status: "error", message });
  }
}

interface Harbour {
  socket: FakeSocket;
  bridge: NestBridge;
  fetchMock: ReturnType<typeof vi.fn>;
  online: { value: boolean };
}

function guestResponse(who: { userId: string; username: string }) {
  return new Response(
    JSON.stringify({ token: tokenFor(who.userId), expiresAt: "2026-10-10T12:00:00.000Z", user: { id: who.userId, username: who.username } }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

function harbour(who: { userId: string; username: string } = ANNE): Harbour {
  const socket = new FakeSocket();
  const online = { value: true };
  const fetchMock = vi.fn(async () => guestResponse(who));
  vi.stubGlobal("fetch", fetchMock);
  const bridge = createNestBridge({
    socket: socket as unknown as Socket,
    serverUrl: SERVER_URL,
    waitForConnection: async () => {
      if (!online.value) return false;
      socket.connected = true;
      return true;
    },
  });
  return { socket, bridge, fetchMock, online };
}

function record<K extends ServerEventName>(bridge: NestBridge, event: K) {
  const seen: ServerEvents[K][] = [];
  bridge.on(event, (payload) => seen.push(payload));
  return seen;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const CREATE = { playerName: "Anne Bonny", avatarId: AVATAR_IDS[0], crewName: "The Black Gull" };
const JOIN = { playerName: "Calico Jack", avatarId: AVATAR_IDS[1], roomCode: CODE };

/** Signs Anne in and seats her as captain of a fresh crew. */
async function seated(initial: NestRoomState = state()) {
  const h = harbour(ANNE);
  h.socket.server = (event, _payload, ack) => {
    if (event === "room:create") h.socket.reply(ack, initial);
  };
  const res = await h.bridge.request("crew:create", CREATE);
  if (!res.ok) throw new Error(`could not seat Anne: ${res.error.code}`);
  await tick();
  h.socket.sent.length = 0;
  return h;
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* Signing in                                                          */
/* ------------------------------------------------------------------ */

describe("signing in", () => {
  it("asks the harbour for a guest pass under the sailor's server name", async () => {
    const { bridge, socket, fetchMock } = harbour();
    socket.server = (event, _payload, ack) => event === "room:create" && socket.reply(ack, state());
    await bridge.request("crew:create", CREATE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${SERVER_URL}/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "anne_bonny" }),
    });
  });

  it("keeps the pass for the socket's handshake", async () => {
    const { bridge, socket } = harbour();
    expect(bridge.token()).toBeNull();
    socket.server = (event, _payload, ack) => event === "room:create" && socket.reply(ack, state());
    await bridge.request("crew:create", CREATE);
    expect(bridge.token()).toBe(tokenFor(ANNE.userId));
  });

  it("does not sign in again under the same name", async () => {
    const h = await seated();
    h.socket.server = (event, _payload, ack) => {
      if (event === "room:leave") ack?.(null);
      if (event === "room:create") h.socket.reply(ack, state({ code: "XYZ789" }));
    };
    await h.bridge.request("crew:leave", {});
    await h.bridge.request("crew:create", CREATE);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a name the harbour rejected", async () => {
    const { bridge, socket, fetchMock } = harbour();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: ["username must match /^[a-z0-9_]{3,16}$/"], statusCode: 400 }), { status: 400 }),
    );
    const res = await bridge.request("crew:create", CREATE);

    expect(res).toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "username must match /^[a-z0-9_]{3,16}$/" },
    });
    expect(socket.sent).toEqual([]);
  });

  it("maps other refusals from the harbour by their message", async () => {
    const { bridge, fetchMock } = harbour();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Too many requests" }), { status: 429 }));
    const res = await bridge.request("crew:create", CREATE);
    expect(res.ok || res.error.code).toBe("RATE_LIMITED");
  });

  it("copes with a harbour that answers with something other than JSON", async () => {
    const { bridge, fetchMock } = harbour();
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
    const res = await bridge.request("crew:create", CREATE);
    expect(res.ok || res.error.code).toBe("INTERNAL");
  });

  it("reports the harbour as unreachable when the request never lands", async () => {
    const { bridge, fetchMock } = harbour();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await bridge.request("crew:create", CREATE);
    expect(res.ok || res.error.code).toBe("OFFLINE");
  });

  it("reports the harbour as unreachable when the socket cannot connect", async () => {
    const { bridge, socket, online } = harbour();
    online.value = false;
    const res = await bridge.request("crew:create", CREATE);
    expect(res.ok || res.error.code).toBe("OFFLINE");
    expect(socket.sent).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Boarding                                                            */
/* ------------------------------------------------------------------ */

describe("raising a crew", () => {
  it("names the crew and hands back a seat", async () => {
    const { bridge, socket } = harbour();
    socket.server = (event, _payload, ack) => event === "room:create" && socket.reply(ack, state());
    const res = await bridge.request("crew:create", CREATE);

    expect(socket.sent).toEqual([{ event: "room:create", payload: { name: "The Black Gull" } }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ playerId: ANNE.id, sessionToken: tokenFor(ANNE.userId), chat: [] });
    expect(res.data.room).toMatchObject({ code: CODE, crewName: "The Black Gull", captainId: ANNE.id, phase: "lobby" });
  });

  it("announces the room again once the seat has been taken", async () => {
    const { bridge, socket } = harbour();
    const states = record(bridge, "room:state");
    socket.server = (event, _payload, ack) => event === "room:create" && socket.reply(ack, state());
    await bridge.request("crew:create", CREATE);
    expect(states).toHaveLength(1);
    await tick();
    expect(states).toHaveLength(2);
    expect(states[1].code).toBe(CODE);
  });
});

describe("joining a crew", () => {
  it("boards the ship with the code", async () => {
    const { bridge, socket } = harbour(JACK);
    socket.server = (event, _payload, ack) => {
      if (event === "room:join") socket.reply(ack, state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    };
    const res = await bridge.request("crew:join", JOIN);

    expect(socket.sent).toEqual([{ event: "room:join", payload: { code: CODE } }]);
    expect(res.ok && res.data.playerId).toBe(JACK.id);
  });

  it.each([
    ["Room not found", "ROOM_NOT_FOUND"],
    ["Crew is full", "ROOM_FULL"],
    ["This hunt is over", "VOYAGE_OVER"],
  ])("explains the server's %j as %s", async (message, code) => {
    const { bridge, socket } = harbour(JACK);
    socket.server = (event) => event === "room:join" && socket.refuse(message);
    const res = await bridge.request("crew:join", JOIN);
    expect(res).toEqual({ ok: false, error: { code, message } });
  });

  it("abandons a stale berth on another ship and tries again", async () => {
    const { bridge, socket } = harbour(JACK);
    let attempts = 0;
    socket.server = (event, _payload, ack) => {
      if (event === "room:join") {
        attempts += 1;
        if (attempts === 1) socket.refuse("Leave crew XYZ789 first");
        else socket.reply(ack, state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
      }
      if (event === "room:leave") ack?.(state({ code: "XYZ789", players: [] }));
    };
    const res = await bridge.request("crew:join", JOIN);

    expect(socket.sent).toEqual([
      { event: "room:join", payload: { code: CODE } },
      { event: "room:leave", payload: { code: "XYZ789" } },
      { event: "room:join", payload: { code: CODE } },
    ]);
    expect(res.ok).toBe(true);
  });

  it("gives up after one retry", async () => {
    const { bridge, socket } = harbour(JACK);
    socket.server = (event, _payload, ack) => {
      if (event === "room:join") socket.refuse("Leave crew XYZ789 first");
      if (event === "room:leave") ack?.(null);
    };
    const res = await bridge.request("crew:join", JOIN);
    expect(res.ok || res.error.code).toBe("IN_ANOTHER_CREW");
    expect(socket.sent.filter((s) => s.event === "room:join")).toHaveLength(2);
  });

  it("ignores the stale ship's farewell state", async () => {
    const { bridge, socket } = harbour(JACK);
    const states = record(bridge, "room:state");
    let attempts = 0;
    socket.server = (event, _payload, ack) => {
      if (event === "room:join") {
        attempts += 1;
        if (attempts === 1) socket.refuse("Leave crew XYZ789 first");
        else socket.reply(ack, state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
      }
      if (event === "room:leave") socket.reply(ack, state({ code: "XYZ789", players: [player(MARY)] }));
    };
    await bridge.request("crew:join", JOIN);
    expect(states.every((s) => s.code === CODE)).toBe(true);
  });
});

describe("rejoining after a refresh", () => {
  it("reuses the stored pass without signing in again", async () => {
    const { bridge, socket, fetchMock } = harbour();
    socket.server = (event, _payload, ack) => event === "room:join" && socket.reply(ack, state());
    const res = await bridge.request("crew:rejoin", { roomCode: CODE, sessionToken: tokenFor(ANNE.userId) });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(socket.sent).toEqual([{ event: "room:join", payload: { code: CODE } }]);
    expect(res.ok && res.data).toMatchObject({ playerId: ANNE.id, sessionToken: tokenFor(ANNE.userId) });
    expect(bridge.token()).toBe(tokenFor(ANNE.userId));
  });

  it("refuses a pass it cannot read", async () => {
    const { bridge, socket } = harbour();
    const res = await bridge.request("crew:rejoin", { roomCode: CODE, sessionToken: "not-a-token" });
    expect(res.ok || res.error.code).toBe("SESSION_EXPIRED");
    expect(socket.sent).toEqual([]);
  });

  it("reconnects when the socket was signed in as someone else", async () => {
    const h = await seated();
    h.socket.server = (event, _payload, ack) => {
      if (event === "room:join") h.socket.reply(ack, state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    };
    const res = await h.bridge.request("crew:rejoin", { roomCode: CODE, sessionToken: tokenFor(JACK.userId) });

    expect(h.socket.disconnects).toHaveBeenCalledTimes(1);
    expect(h.bridge.token()).toBe(tokenFor(JACK.userId));
    expect(res.ok && res.data.playerId).toBe(JACK.id);
  });

  it("reports a seat the server no longer holds", async () => {
    const { bridge, socket } = harbour();
    socket.server = (event, _payload, ack) => event === "room:join" && socket.reply(ack, state({ players: [player(JACK)] }));
    const res = await bridge.request("crew:rejoin", { roomCode: CODE, sessionToken: tokenFor(ANNE.userId) });
    expect(res.ok || res.error.code).toBe("NOT_IN_ROOM");
  });
});

describe("leaving", () => {
  it("tells the server which ship it is leaving", async () => {
    const h = await seated();
    h.socket.server = (event, _payload, ack) => event === "room:leave" && ack?.(null);
    const res = await h.bridge.request("crew:leave", {});
    expect(h.socket.sent).toEqual([{ event: "room:leave", payload: { code: CODE } }]);
    expect(res).toEqual({ ok: true, data: null });
  });

  it("does nothing for a sailor who holds no seat", async () => {
    const { bridge, socket } = harbour();
    expect(await bridge.request("crew:leave", {})).toEqual({ ok: true, data: null });
    expect(socket.sent).toEqual([]);
  });

  it("ignores the final state the server sends while leaving", async () => {
    const h = await seated();
    const states = record(h.bridge, "room:state");
    h.socket.server = (event, _payload, ack) => event === "room:leave" && h.socket.reply(ack, state({ players: [player(JACK)] }));
    await h.bridge.request("crew:leave", {});
    expect(states).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Talking to the server                                               */
/* ------------------------------------------------------------------ */

describe("waiting for the server", () => {
  it("gives up after eight seconds of silence", async () => {
    const h = await seated();
    vi.useFakeTimers();
    const pending = h.bridge.request("map:move", { islandKey: "blackreef" });
    await vi.advanceTimersByTimeAsync(7999);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: false, error: { code: "TIMEOUT" } });
  });

  it("reports the connection dropping mid-request", async () => {
    const h = await seated();
    h.socket.server = () => h.socket.disconnect();
    const res = await h.bridge.request("map:move", { islandKey: "blackreef" });
    expect(res.ok || res.error.code).toBe("OFFLINE");
  });

  it("stops listening for errors once a request is answered", async () => {
    const h = await seated();
    const before = h.socket.listenerCount("game:error");
    h.socket.server = (event, _payload, ack) => event === "map:move" && h.socket.reply(ack, state({ status: "ACTIVE" }));
    await h.bridge.request("map:move", { islandKey: "blackreef" });
    expect(h.socket.listenerCount("game:error")).toBe(before);
    expect(h.socket.listenerCount("disconnect")).toBe(0);
  });

  it("does not pin a late error on the next request", async () => {
    const h = await seated();
    h.socket.server = (event, _payload, ack) => event === "map:move" && h.socket.reply(ack, state({ status: "ACTIVE" }));
    await h.bridge.request("map:move", { islandKey: "port-royal" });
    h.socket.refuse("Island not found");
    const res = await h.bridge.request("map:move", { islandKey: "blackreef" });
    expect(res.ok).toBe(true);
  });

  it("sends one request at a time, in order", async () => {
    const h = await seated();
    const acks: Ack[] = [];
    h.socket.server = (event, _payload, ack) => event === "map:move" && acks.push(ack);
    const first = h.bridge.request("map:move", { islandKey: "blackreef" });
    const second = h.bridge.request("map:move", { islandKey: "serpent-cay" });
    await tick();
    expect(h.socket.sent.map((s) => s.payload.islandKey)).toEqual(["blackreef"]);

    acks[0]?.(state({ status: "ACTIVE" }));
    await first;
    await tick();
    expect(h.socket.sent.map((s) => s.payload.islandKey)).toEqual(["blackreef", "serpent-cay"]);
    acks[1]?.(state({ status: "ACTIVE" }));
    expect((await second).ok).toBe(true);
  });

  it("keeps serving requests after one of them fails", async () => {
    const h = await seated();
    h.socket.server = (event, payload, ack) => {
      if (event !== "map:move") return;
      if (payload.islandKey === "atlantis") h.socket.refuse("Island not found");
      else h.socket.reply(ack, state({ status: "ACTIVE" }));
    };
    const failed = await h.bridge.request("map:move", { islandKey: "atlantis" });
    const next = await h.bridge.request("map:move", { islandKey: "blackreef" });
    expect(failed.ok || failed.error.code).toBe("ISLAND_NOT_FOUND");
    expect(next.ok).toBe(true);
  });
});

describe("requests the server has no answer for", () => {
  it.each([
    ["player:ready", { ready: true }],
    ["crew:kick", { playerId: JACK.id }],
    ["crew:configure", { settings: { maxStrikes: 2 } }],
    ["puzzle:hint", { puzzleKey: "blackreef-cipher", payWith: "strike" }],
    ["spectate:follow", { playerId: JACK.id }],
    ["chat:send", { text: "Ahoy" }],
  ] as const)("answers %s with UNSUPPORTED without bothering the server", async (name, payload) => {
    const h = await seated();
    const res = await h.bridge.request(name, payload as never);
    expect(res.ok || res.error.code).toBe("UNSUPPORTED");
    expect(h.socket.sent).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* The voyage                                                          */
/* ------------------------------------------------------------------ */

describe("setting sail", () => {
  it("weighs anchor with a move to where the captain stands", async () => {
    const h = await seated(state({ players: [player(ANNE, { isHost: true, currentIslandKey: "port-royal" })] }));
    h.socket.server = (event, _payload, ack) => event === "map:move" && h.socket.reply(ack, state({ status: "ACTIVE" }));
    const res = await h.bridge.request("game:start", {});
    expect(h.socket.sent).toEqual([{ event: "map:move", payload: { code: CODE, islandKey: "port-royal" } }]);
    expect(res).toEqual({ ok: true, data: null });
  });

  it("starts from the home port when the captain has no position yet", async () => {
    const h = await seated(state({ players: [player(ANNE, { isHost: true, currentIslandKey: null })] }));
    h.socket.server = (event, _payload, ack) => event === "map:move" && h.socket.reply(ack, state({ status: "ACTIVE" }));
    await h.bridge.request("game:start", {});
    expect(h.socket.sent[0].payload.islandKey).toBe("port-royal");
  });

  it("refuses for a sailor without a seat", async () => {
    const { bridge } = harbour();
    const res = await bridge.request("game:start", {});
    expect(res.ok || res.error.code).toBe("NOT_IN_ROOM");
  });

  it("announces the voyage when the server leaves the lobby", async () => {
    const h = await seated();
    const started = record(h.bridge, "game:started");
    h.socket.server = (name, _payload, ack) =>
      name === "map:move" &&
      h.socket.reply(ack, state({ status: "ACTIVE", log: [event("MOVED", ANNE.id, { islandKey: "port-royal" })] }));
    await h.bridge.request("game:start", {});
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ roomCode: CODE, endsAt: null });
  });
});

describe("sailing", () => {
  it("reports when a landing lifts the fog", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    h.socket.server = (event, payload, ack) =>
      event === "map:move" &&
      h.socket.reply(
        ack,
        state({ status: "ACTIVE", players: [player(ANNE, { isHost: true, currentIslandKey: payload.islandKey as string })] }),
      );

    const first = await h.bridge.request("map:move", { islandKey: "blackreef" });
    const again = await h.bridge.request("map:move", { islandKey: "blackreef" });
    expect(first).toEqual({ ok: true, data: { islandKey: "blackreef", discovered: true } });
    expect(again).toEqual({ ok: true, data: { islandKey: "blackreef", discovered: false } });
  });

  it("sends the crew code with every move", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    h.socket.server = (event, _payload, ack) => event === "map:move" && h.socket.reply(ack, state({ status: "ACTIVE" }));
    await h.bridge.request("map:move", { islandKey: "goldmouth" });
    expect(h.socket.sent).toEqual([{ event: "map:move", payload: { code: CODE, islandKey: "goldmouth" } }]);
  });

  it("passes on the server's refusal", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    h.socket.server = (event) => event === "map:move" && h.socket.refuse("You are out of the hunt");
    const res = await h.bridge.request("map:move", { islandKey: "goldmouth" });
    expect(res.ok || res.error.code).toBe("ELIMINATED");
  });
});

describe("answering riddles", () => {
  const sailing = () => state({ status: "ACTIVE", players: [player(ANNE, { isHost: true, currentIslandKey: "blackreef" })] });

  it("sends the answer exactly as typed and lets the server judge it", async () => {
    const h = await seated(sailing());
    h.socket.server = (event, _payload, ack) => event === "puzzle:submit" && h.socket.reply(ack, sailing());
    await h.bridge.request("puzzle:submit", { puzzleKey: "blackreef-cipher", answer: "  Treasure " });
    expect(h.socket.sent).toEqual([
      { event: "puzzle:submit", payload: { code: CODE, puzzleKey: "blackreef-cipher", answer: "  Treasure " } },
    ]);
  });

  it("reports a solve the server recorded", async () => {
    const h = await seated(sailing());
    h.socket.server = (event, _payload, ack) =>
      event === "puzzle:submit" &&
      h.socket.reply(ack, {
        ...sailing(),
        progress: [{ playerId: ANNE.id, puzzleKey: "blackreef-cipher" }],
        you: [item("spyglass")],
      });
    const res = await h.bridge.request("puzzle:submit", { puzzleKey: "blackreef-cipher", answer: "treasure" });
    expect(res).toEqual({
      ok: true,
      data: { outcome: "solved", puzzleKey: "blackreef-cipher", strikes: 0, eliminated: false, reward: "spyglass", treasureFound: false },
    });
  });

  it("reports a wrong answer when the server changed nothing", async () => {
    const h = await seated(sailing());
    h.socket.server = (event, _payload, ack) => event === "puzzle:submit" && h.socket.reply(ack, sailing());
    const res = await h.bridge.request("puzzle:submit", { puzzleKey: "blackreef-cipher", answer: "gold" });
    expect(res.ok && res.data.outcome).toBe("wrong");
  });

  it("reports a trap when the server added a strike", async () => {
    const h = await seated(sailing());
    h.socket.server = (event, _payload, ack) =>
      event === "puzzle:submit" &&
      h.socket.reply(ack, {
        ...sailing(),
        players: [player(ANNE, { isHost: true, currentIslandKey: "kraken-shoal", strikes: 1 })],
        you: [item("cursed-coin")],
      });
    const res = await h.bridge.request("puzzle:submit", { puzzleKey: "kraken-arms", answer: "8" });
    expect(res.ok && res.data).toMatchObject({ outcome: "trap", strikes: 1, reward: "cursed-coin" });
  });

  it("refuses before the crew has a state", async () => {
    const { bridge } = harbour();
    const res = await bridge.request("puzzle:submit", { puzzleKey: "blackreef-cipher", answer: "treasure" });
    expect(res.ok || res.error.code).toBe("NOT_IN_ROOM");
  });
});

describe("trading", () => {
  it("hands over the whole stack and reports its size", async () => {
    const crew = [player(ANNE, { isHost: true }), player(JACK)];
    const h = await seated(state({ status: "ACTIVE", players: crew, you: [item("tide-rumor", 3)] }));
    h.socket.server = (event, _payload, ack) => event === "trade:offer" && h.socket.reply(ack, state({ status: "ACTIVE", players: crew }));
    const res = await h.bridge.request("trade:offer", { toPlayerId: JACK.id, itemKey: "tide-rumor" });

    expect(h.socket.sent).toEqual([{ event: "trade:offer", payload: { code: CODE, toPlayerId: JACK.id, itemKey: "tide-rumor" } }]);
    expect(res).toEqual({ ok: true, data: { itemKey: "tide-rumor", quantity: 3, toPlayerId: JACK.id } });
  });

  it("passes on the server's refusal", async () => {
    const h = await seated(state({ status: "ACTIVE", you: [item("compass")] }));
    h.socket.server = (event) => event === "trade:offer" && h.socket.refuse("That item cannot be traded");
    const res = await h.bridge.request("trade:offer", { toPlayerId: JACK.id, itemKey: "compass" });
    expect(res.ok || res.error.code).toBe("NOT_TRADABLE");
  });
});

describe("catching up on the log", () => {
  it("answers from the events the server still keeps", async () => {
    const log = [
      event("MOVED", ANNE.id, { islandKey: "blackreef" }),
      event("PUZZLE_SOLVED", ANNE.id, { puzzleKey: "blackreef-cipher" }),
    ];
    const h = await seated(state({ status: "ACTIVE", log }));
    const res = await h.bridge.request("voyage:sync", { sinceSeq: 1 });
    expect(res.ok && res.data.events.map((e) => e.id)).toEqual([log[1].id]);
    expect(res.ok && res.data).toMatchObject({ lastSeq: 2, complete: false });
    expect(h.socket.sent).toEqual([]);
  });

  it("refuses before the crew has set sail", async () => {
    const { bridge } = harbour();
    const res = await bridge.request("voyage:sync", { sinceSeq: 0 });
    expect(res.ok || res.error.code).toBe("NOT_SAILING");
  });
});

/* ------------------------------------------------------------------ */
/* Pushes from the server                                              */
/* ------------------------------------------------------------------ */

describe("pushes from the server", () => {
  it("ignores states for crews this sailor is not boarding", async () => {
    const { bridge, socket } = harbour();
    const states = record(bridge, "room:state");
    socket.fire("room:state", state());
    expect(states).toEqual([]);
  });

  it("ignores states for another crew once seated", async () => {
    const h = await seated();
    const states = record(h.bridge, "room:state");
    h.socket.fire("room:state", state({ code: "XYZ789" }));
    expect(states).toEqual([]);
  });

  it("announces arrivals before the state that contains them", async () => {
    const h = await seated();
    const order: string[] = [];
    h.bridge.on("room:player-joined", ({ player: p }) => order.push(`joined:${p.name}`));
    h.bridge.on("room:state", (push) => order.push(`state:${push.players.length}`));
    h.socket.fire("room:state", state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(order).toEqual(["joined:Calico Jack", "state:2"]);
  });

  it("announces departures and a new captain", async () => {
    const h = await seated(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const left = record(h.bridge, "room:player-left");
    const captains = record(h.bridge, "room:captain-changed");
    h.socket.fire("room:state", state({ players: [player(JACK)] }));
    expect(left).toEqual([{ playerId: ANNE.id, name: "Anne Bonny", reason: "left" }]);
    expect(captains).toEqual([{ captainId: JACK.id }]);
  });

  it("passes on presence changes as player updates", async () => {
    const h = await seated(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const updates = record(h.bridge, "room:player-updated");
    h.socket.fire("presence:changed", { code: CODE, playerId: JACK.id, userId: JACK.userId, online: false, lastSeenAt: "" });
    expect(updates).toHaveLength(1);
    expect(updates[0].player).toMatchObject({ id: JACK.id, isConnected: false });
  });

  it("ignores presence for another crew", async () => {
    const h = await seated(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const updates = record(h.bridge, "room:player-updated");
    h.socket.fire("presence:changed", { code: "XYZ789", playerId: JACK.id, userId: JACK.userId, online: false, lastSeenAt: "" });
    expect(updates).toEqual([]);
  });

  it("numbers and labels the server's game events", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    const events = record(h.bridge, "game:event");
    const moved = event("MOVED", ANNE.id, { islandKey: "blackreef" });
    h.socket.fire("game:event", { ...moved, code: CODE });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: moved.id, seq: 1, type: "MOVED", roomCode: CODE });
  });

  it("ignores game events for another crew", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    const events = record(h.bridge, "game:event");
    h.socket.fire("game:event", { ...event("MOVED", JACK.id, { islandKey: "blackreef" }), code: "XYZ789" });
    expect(events).toEqual([]);
  });

  it("announces the end of the voyage with the server's winner", async () => {
    const h = await seated(state({ status: "ACTIVE" }));
    const finished = record(h.bridge, "game:finished");
    h.socket.fire("room:state", state({ status: "FINISHED", winnerPlayerId: ANNE.id }));
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ roomCode: CODE, winnerPlayerId: ANNE.id, reason: "treasure", scores: [] });
  });

  it("wakes the Vault shortly after the fifth relic lands", async () => {
    const h = await seated(state({ status: "ACTIVE", you: ALL_RELICS.slice(0, 4) }));
    const events = record(h.bridge, "game:event");
    vi.useFakeTimers();
    h.socket.fire("room:state", state({ status: "ACTIVE", you: ALL_RELICS }));
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(150);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "VAULT_AWAKENED", roomCode: CODE, playerId: ANNE.id });
  });

  it("stays quiet about the Vault if the sailor left in the meantime", async () => {
    const h = await seated(state({ status: "ACTIVE", you: ALL_RELICS.slice(0, 4) }));
    const events = record(h.bridge, "game:event");
    h.socket.server = (event, _payload, ack) => event === "room:leave" && ack?.(null);
    vi.useFakeTimers();
    h.socket.fire("room:state", state({ status: "ACTIVE", you: ALL_RELICS }));
    await h.bridge.request("crew:leave", {});
    await vi.advanceTimersByTimeAsync(150);
    expect(events).toEqual([]);
  });

  it("stops calling a listener once it unsubscribes", async () => {
    const h = await seated();
    const seen: unknown[] = [];
    const off = h.bridge.on("room:state", (push) => seen.push(push));
    off();
    h.socket.fire("room:state", state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(seen).toEqual([]);
  });
});
