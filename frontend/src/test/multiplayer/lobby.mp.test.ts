import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { sailors, sleep, startMockServer, type MockServer, type Sailor } from "./harness";

interface Seat {
  room: { code: string; phase: string; captainId: string; players: { id: string; name: string; isReady: boolean; isConnected: boolean }[] };
  playerId: string;
  sessionToken: string;
}
type RoomSnapshot = Seat["room"];

let server: MockServer;
let open: Sailor[] = [];

beforeAll(async () => {
  server = await startMockServer();
});
afterAll(() => server?.stop());
afterEach(() => {
  open.forEach((s) => s.close());
  open = [];
});

async function crew(...labels: string[]) {
  const list = await sailors(server.url, ...labels);
  open.push(...list);
  return list;
}

const create = (s: Sailor, playerName: string, crewName = "The Black Gull") =>
  s.must<Seat>("crew:create", { playerName, crewName, avatarId: "captain" });
const join = (s: Sailor, roomCode: string, playerName: string) =>
  s.request<Seat>("crew:join", { roomCode, playerName, avatarId: "corsair" });

describe("lobby: full voyage launch", () => {
  it("founds a crew, fills it, readies up and starts together", async () => {
    const [anne, jack, mary] = await crew("anne", "jack", "mary");
    const seat = await create(anne, "Anne");
    const code = seat.room.code;
    expect(seat.room.captainId).toBe(seat.playerId);

    for (const [s, name] of [[jack, "Jack"], [mary, "Mary"]] as const) {
      const ack = await join(s, code, name);
      expect(ack.ok).toBe(true);
    }
    const full = await anne.waitFor<RoomSnapshot>("room:state", (r) => r.players.length === 3);
    expect(full.players.map((p) => p.name).sort()).toEqual(["Anne", "Jack", "Mary"]);

    await Promise.all([anne, jack, mary].map((s) => s.must("player:ready", { ready: true })));
    await anne.waitFor<RoomSnapshot>("room:state", (r) => r.players.every((p) => p.isReady));

    await anne.must("game:start");
    const countdowns = await Promise.all([anne, jack, mary].map((s) => s.waitFor<{ seconds: number }>("game:starting")));
    expect(new Set(countdowns.map((c) => c.seconds)).size).toBe(1);
    await Promise.all([anne, jack, mary].map((s) => s.waitFor("game:started", () => true, 6_000)));
  }, 10_000);
});

describe("lobby: the server refuses what it should", () => {
  it("only lets the captain start", async () => {
    const [anne, jack] = await crew("anne", "jack");
    const { room } = await create(anne, "Anne");
    await join(jack, room.code, "Jack");
    await Promise.all([anne, jack].map((s) => s.must("player:ready", { ready: true })));
    const ack = await jack.request("game:start");
    expect(ack).toMatchObject({ ok: false, error: { code: "NOT_CAPTAIN" } });
  });

  it("won't start with unready or too few sailors", async () => {
    const [anne, jack] = await crew("anne", "jack");
    const { room } = await create(anne, "Anne");
    await anne.must("player:ready", { ready: true });
    expect(await anne.request("game:start")).toMatchObject({ ok: false, error: { code: "NOT_ENOUGH_PLAYERS" } });
    await join(jack, room.code, "Jack");
    expect(await anne.request("game:start")).toMatchObject({ ok: false, error: { code: "PLAYERS_NOT_READY" } });
  });

  it("rejects a duplicate name regardless of case", async () => {
    const [anne, jack] = await crew("anne", "jack");
    const { room } = await create(anne, "Anne");
    expect(await join(jack, room.code, "aNNe")).toMatchObject({ ok: false, error: { code: "NAME_TAKEN" } });
  });

  it("caps the crew at its maximum", async () => {
    const list = await crew("s0", "s1", "s2", "s3", "s4", "s5", "s6");
    const { room } = await create(list[0], "Sailor0");
    for (let i = 1; i < 6; i++) expect((await join(list[i], room.code, `Sailor${i}`)).ok).toBe(true);
    expect(await join(list[6], room.code, "Sailor6")).toMatchObject({ ok: false, error: { code: "ROOM_FULL" } });
  });

  it("closes the gangway once the voyage is underway", async () => {
    const [anne, jack, late] = await crew("anne", "jack", "late");
    const { room } = await create(anne, "Anne");
    await join(jack, room.code, "Jack");
    await Promise.all([anne, jack].map((s) => s.must("player:ready", { ready: true })));
    await anne.must("game:start");
    expect(await join(late, room.code, "Late")).toMatchObject({ ok: false, error: { code: "GAME_IN_PROGRESS" } });
  });

  it("turns away unknown rooms and malformed payloads", async () => {
    const [anne] = await crew("anne");
    expect(await join(anne, "ZZZZZZ", "Anne")).toMatchObject({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
    expect(await join(anne, "ZZ", "Anne")).toMatchObject({ ok: false, error: { code: "INVALID_PAYLOAD" } });
    const bads = [null, {}, { playerName: "A", crewName: "Gull", avatarId: "captain" }, { playerName: "Anne", crewName: "Gull", avatarId: "kraken" }];
    const fresh = await crew(...bads.map((_, i) => `bad${i}`));
    for (const [i, bad] of bads.entries()) {
      expect(await fresh[i].request("crew:create", bad)).toMatchObject({ ok: false, error: { code: "INVALID_PAYLOAD" } });
    }
    expect(await anne.request("player:ready", { ready: true })).toMatchObject({ ok: false, error: { code: "NOT_IN_ROOM" } });
  });

  it("rate-limits a socket that hammers crew creation", async () => {
    const [spammer] = await crew("spammer");
    const codes: string[] = [];
    for (let i = 0; i < 12; i++) {
      const ack = await spammer.request("crew:create", {});
      codes.push(ack.ok ? "ok" : ack.error.code);
    }
    expect(codes).toContain("RATE_LIMITED");
  });
});

describe("lobby: concurrency and reconnection", () => {
  it("lets exactly one of two simultaneous same-name joins win", async () => {
    const [anne, a, b] = await crew("anne", "a", "b");
    const { room } = await create(anne, "Anne");
    const [first, second] = await Promise.all([join(a, room.code, "Jack"), join(b, room.code, "Jack")]);
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    const loser = first.ok ? second : first;
    expect(loser).toMatchObject({ ok: false, error: { code: "NAME_TAKEN" } });
  });

  it("keeps a dropped sailor's seat and restores it on rejoin", async () => {
    const [anne, jack] = await crew("anne", "jack");
    const { room } = await create(anne, "Anne");
    const jackSeat = (await join(jack, room.code, "Jack")) as { ok: true; data: Seat };
    jack.close();

    const dropped = await anne.waitFor<RoomSnapshot>("room:state", (r) =>
      r.players.some((p) => p.id === jackSeat.data.playerId && !p.isConnected),
    );
    expect(dropped.players).toHaveLength(2);

    const [back] = await crew("jack-again");
    const rejoined = await back.must<Seat>("crew:rejoin", { roomCode: room.code, sessionToken: jackSeat.data.sessionToken });
    expect(rejoined.playerId).toBe(jackSeat.data.playerId);
    await anne.waitFor<RoomSnapshot>("room:state", (r) => r.players.every((p) => p.isConnected));
  });

  it("refuses a forged session token", async () => {
    const [anne, thief] = await crew("anne", "thief");
    const { room } = await create(anne, "Anne");
    expect(await thief.request("crew:rejoin", { roomCode: room.code, sessionToken: "not-a-real-token" })).toMatchObject({
      ok: false,
      error: { code: "SESSION_EXPIRED" },
    });
  });

  it("hands the captaincy on when the captain leaves", async () => {
    const [anne, jack] = await crew("anne", "jack");
    const { room } = await create(anne, "Anne");
    const jackSeat = (await join(jack, room.code, "Jack")) as { ok: true; data: Seat };
    await anne.must("crew:leave");
    const changed = await jack.waitFor<{ captainId: string }>("room:captain-changed");
    expect(changed.captainId).toBe(jackSeat.data.playerId);
  });

  it("broadcasts every crew change to everyone aboard", async () => {
    const [anne, jack, mary] = await crew("anne", "jack", "mary");
    const { room } = await create(anne, "Anne");
    await join(jack, room.code, "Jack");
    jack.clearSeen();
    await join(mary, room.code, "Mary");
    await Promise.all([anne, jack].map((s) => s.waitFor<{ player: { name: string } }>("room:player-joined", (e) => e.player.name === "Mary")));
    await sleep(50);
    expect(mary.events("room:player-joined")).toHaveLength(0);
  });
});
