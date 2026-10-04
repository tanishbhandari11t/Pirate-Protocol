import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { attachGambit, GAMBIT_RULES } from "../../../mock-server/gambit.mjs";
import type { GambitDuel } from "@/lib/socket/gambit";
import { diceTotal } from "@/lib/socket/gambit";
import { freePort, type Ack } from "./harness";

/** A bare socket.io server with only the gambit attached; seats come from the handshake. */
let io: Server;
let url: string;
let now = 1_000_000;
const clients: Socket[] = [];

beforeAll(async () => {
  const port = await freePort();
  const http = createServer();
  io = new Server(http);
  attachGambit(io, {
    seatOf: (s) => {
      const { room, player } = s.handshake.auth as { room?: string; player?: string };
      return room && player ? { roomCode: room, playerId: player } : null;
    },
    now: () => now,
    roundGapMs: 5,
  });
  await new Promise<void>((r) => http.listen(port, r));
  url = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await new Promise<void>((r) => io.close(() => r()));
});

async function seat(room: string, player: string) {
  const s = connect(url, { auth: { room, player }, transports: ["websocket"], forceNew: true });
  clients.push(s);
  await new Promise<void>((r) => s.once("connect", () => r()));
  return s;
}

const ask = <T,>(s: Socket, event: string, payload: unknown) =>
  new Promise<Ack<T>>((r) => s.emit(event, payload, (res: Ack<T>) => r(res)));

const settled = (s: Socket) =>
  new Promise<GambitDuel>((r) => {
    const on = (d: GambitDuel) => {
      if (d.status === "done" || d.status === "declined" || d.status === "expired") {
        s.off("gambit:update", on);
        r(d);
      }
    };
    s.on("gambit:update", on);
  });

describe("Captain's Gambit (server-rolled dice duel)", () => {
  it("plays a full duel the server rolls, pushing every round to both duellists only", async () => {
    const anne = await seat("ROOM01", "anne");
    const jack = await seat("ROOM01", "jack");
    const mary = await seat("ROOM01", "mary");
    const peeked: GambitDuel[] = [];
    mary.on("gambit:update", (d: GambitDuel) => peeked.push(d));

    const offer = await ask<GambitDuel>(anne, "gambit:challenge", { toPlayerId: "jack" });
    expect(offer.ok).toBe(true);
    if (!offer.ok) return;
    expect(offer.data).toMatchObject({ challengerId: "anne", defenderId: "jack", status: "pending", rounds: [] });

    const endA = settled(anne);
    const endJ = settled(jack);
    const accept = await ask<GambitDuel>(jack, "gambit:respond", { duelId: offer.data.id, accept: true });
    expect(accept.ok && accept.data.status).toBe("rolling");

    const [a, j] = await Promise.all([endA, endJ]);
    expect(a).toEqual(j);
    expect(a.rounds.length).toBeGreaterThanOrEqual(GAMBIT_RULES.roundsToWin);
    expect(a.rounds.length).toBeLessThanOrEqual(GAMBIT_RULES.maxRounds);
    for (const r of a.rounds) {
      expect(r.challenger).toHaveLength(GAMBIT_RULES.dicePerRoll);
      r.challenger.concat(r.defender).forEach((d) => expect(d >= 1 && d <= 6).toBe(true));
      const expected = diceTotal(r.challenger) === diceTotal(r.defender) ? null : diceTotal(r.challenger) > diceTotal(r.defender) ? "challenger" : "defender";
      expect(r.winner).toBe(expected);
    }
    if (a.winnerId) expect(["anne", "jack"]).toContain(a.winnerId);
    expect(peeked).toEqual([]);
  });

  it("refuses wagers it shouldn't take", async () => {
    now += 10_000;
    const anne = await seat("ROOM02", "anne");
    const jack = await seat("ROOM02", "jack");
    await seat("OTHER9", "bart");
    const code = async (s: Socket, event: string, payload: unknown) => {
      const res = await ask(s, event, payload);
      return res.ok ? "ok" : res.error.code;
    };

    expect(await code(anne, "gambit:challenge", { toPlayerId: "anne" })).toBe("INVALID_PAYLOAD");
    expect(await code(anne, "gambit:challenge", { toPlayerId: "bart" })).toBe("BAD_RECIPIENT");

    const offer = await ask<GambitDuel>(anne, "gambit:challenge", { toPlayerId: "jack" });
    expect(offer.ok).toBe(true);
    if (!offer.ok) return;
    now += GAMBIT_RULES.cooldownMs + 1;
    expect(await code(jack, "gambit:challenge", { toPlayerId: "anne" })).toBe("NOT_ALLOWED");
    expect(await code(anne, "gambit:respond", { duelId: offer.data.id, accept: true })).toBe("NOT_ALLOWED");

    const declined = await ask<GambitDuel>(jack, "gambit:respond", { duelId: offer.data.id, accept: false });
    expect(declined.ok && declined.data.status).toBe("declined");
    expect(await code(jack, "gambit:respond", { duelId: offer.data.id, accept: true })).toBe("NOT_FOUND");
  });

  it("rate-limits rapid challenges and ignores unseated sockets", async () => {
    now += 10_000;
    const anne = await seat("ROOM03", "anne");
    await seat("ROOM03", "jack");
    const first = await ask(anne, "gambit:challenge", { toPlayerId: "jack" });
    expect(first.ok).toBe(true);
    const again = await ask(anne, "gambit:challenge", { toPlayerId: "jack" });
    expect(!again.ok && again.error.code).toBe("RATE_LIMITED");

    const unseated = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(unseated);
    await new Promise<void>((r) => unseated.once("connect", () => r()));
    const res = await ask(unseated, "gambit:challenge", { toPlayerId: "jack" });
    expect(!res.ok && res.error.code).toBe("NOT_IN_ROOM");
  });
});
