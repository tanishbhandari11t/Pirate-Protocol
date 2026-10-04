import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { attachMapMarks, type MarkSeat, type ServerMark } from "../../../mock-server/marks.mjs";
import { cleanMarkRequest, MARK_LIMITS as CLIENT_LIMITS } from "@/lib/socket/marks";
import { freePort, sailors, type Sailor } from "./harness";

/**
 * Map marks against a real socket.io server. Seating is faked through a test-only event so the
 * scenarios exercise the relay itself: validation, ownership, limits, rate limiting and broadcast.
 */

let io: Server;
let url: string;
let clock = 1_000_000;
const seats = new Map<string, MarkSeat>();
let marks: ReturnType<typeof attachMapMarks>;
let open: Sailor[] = [];

beforeAll(async () => {
  const port = await freePort();
  const http = createServer();
  io = new Server(http);
  marks = attachMapMarks(io, { seatOf: (socket: Socket) => seats.get(socket.id) ?? null, now: () => clock });
  io.on("connection", (socket) => {
    socket.on("test:seat", (seat: MarkSeat, ack: () => void) => {
      seats.set(socket.id, seat);
      socket.join(seat.roomCode);
      marks.sendTo(socket, seat.roomCode);
      ack();
    });
  });
  await new Promise<void>((resolve) => http.listen(port, resolve));
  url = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  marks?.stop();
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

afterEach(() => {
  open.forEach((s) => s.close());
  open = [];
  seats.clear();
});

let roomSeq = 0;
async function crewAtSea(count: number, canMark = true) {
  const roomCode = `ROOM${++roomSeq}`;
  const list = await sailors(url, ...Array.from({ length: count }, (_, i) => `sailor${i}`));
  open.push(...list);
  await Promise.all(
    list.map(
      (s, i) => new Promise<void>((resolve) => s.socket.emit("test:seat", { roomCode, playerId: `p${i}`, canMark }, resolve)),
    ),
  );
  return { roomCode, list };
}

type Push = { marks: ServerMark[] };

describe("map marks relay", () => {
  it("relays a pin to the whole crew with a server-owned id", async () => {
    const { list } = await crewAtSea(3);
    const [anne, jack, mary] = list;
    const placed = await anne.must<ServerMark>("map:mark", { kind: "pin", points: [{ x: 40.26, y: 12 }] });
    expect(placed.playerId).toBe("p0");
    expect(placed.points).toEqual([{ x: 40.5, y: 12 }]);
    for (const s of [anne, jack, mary]) {
      const push = await s.waitFor<Push>("map:marks", (p) => p.marks.length === 1);
      expect(push.marks[0].id).toBe(placed.id);
    }
  });

  it("sends the current chart to a sailor who boards late", async () => {
    const { roomCode, list } = await crewAtSea(1);
    await list[0].must("map:mark", { kind: "danger", points: [{ x: 10, y: 10 }] });
    const [late] = await sailors(url, "late");
    open.push(late);
    await new Promise<void>((resolve) => late.socket.emit("test:seat", { roomCode, playerId: "late", canMark: true }, resolve));
    const push = await late.waitFor<Push>("map:marks");
    expect(push.marks.map((m) => m.kind)).toEqual(["danger"]);
  });

  it("keeps each crew's ink to itself", async () => {
    const a = await crewAtSea(1);
    const b = await crewAtSea(1);
    await a.list[0].must("map:mark", { kind: "pin", points: [{ x: 1, y: 1 }] });
    await a.list[0].waitFor<Push>("map:marks", (p) => p.marks.length === 1);
    expect(b.list[0].events("map:marks").every((p) => (p as Push).marks.length === 0)).toBe(true);
    expect(marks.marksOf(b.roomCode)).toHaveLength(0);
  });

  it("only lets a sailor wipe their own marks", async () => {
    const { list } = await crewAtSea(2);
    const [anne, jack] = list;
    const placed = await anne.must<ServerMark>("map:mark", { kind: "treasure", points: [{ x: 50, y: 50 }] });
    expect(await jack.request("map:unmark", { markId: placed.id })).toMatchObject({ ok: false, error: { code: "NOT_ALLOWED" } });
    expect(await jack.request("map:unmark", { markId: "nope" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    await anne.must("map:unmark", { markId: placed.id });
    await jack.waitFor<Push>("map:marks", (p) => p.marks.length === 0 && jack.events("map:marks").length > 2);
  });

  it("retires a sailor's oldest mark past the limit", async () => {
    const { roomCode, list } = await crewAtSea(1);
    const ids: string[] = [];
    for (let i = 0; i <= CLIENT_LIMITS.perSailor; i++) {
      clock += 10;
      ids.push((await list[0].must<ServerMark>("map:mark", { kind: "pin", points: [{ x: i, y: i }] })).id);
    }
    const live = marks.marksOf(roomCode).map((m) => m.id);
    expect(live).toHaveLength(CLIENT_LIMITS.perSailor);
    expect(live).not.toContain(ids[0]);
  });

  it("validates every payload server-side, exactly like the client does", async () => {
    const { list } = await crewAtSea(1);
    const bad = [
      null,
      { kind: "kraken", points: [{ x: 1, y: 1 }] },
      { kind: "pin", points: [] },
      { kind: "pin", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
      { kind: "route", points: [{ x: 1, y: 1 }, { x: 1.5, y: 1 }] },
      { kind: "route", points: Array.from({ length: 30 }, (_, i) => ({ x: i, y: 0 })) },
      { kind: "pin", points: [{ x: "1", y: 1 }] },
    ];
    for (const payload of bad) {
      expect(cleanMarkRequest(payload)).toBeNull();
      expect(await list[0].request("map:mark", payload)).toMatchObject({ ok: false, error: { code: "INVALID_PAYLOAD" } });
    }
  });

  it("refuses sailors who aren't seated or aren't allowed to mark", async () => {
    const [stranger] = await sailors(url, "stranger");
    open.push(stranger);
    expect(await stranger.request("map:mark", { kind: "pin", points: [{ x: 1, y: 1 }] })).toMatchObject({
      ok: false,
      error: { code: "NOT_IN_ROOM" },
    });
    const { list } = await crewAtSea(1, false);
    expect(await list[0].request("map:mark", { kind: "pin", points: [{ x: 1, y: 1 }] })).toMatchObject({
      ok: false,
      error: { code: "NOT_ALLOWED" },
    });
  });

  it("rate-limits a sailor spamming the chart", async () => {
    const { list } = await crewAtSea(1);
    const results = await Promise.all(
      Array.from({ length: CLIENT_LIMITS.perMinute + 4 }, (_, i) => list[0].request("map:mark", { kind: "pin", points: [{ x: i, y: 0 }] })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(CLIENT_LIMITS.perMinute);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error.code === "RATE_LIMITED")).toBe(true);
    clock += 61_000;
    expect((await list[0].request("map:mark", { kind: "pin", points: [{ x: 99, y: 0 }] })).ok).toBe(true);
  });

  it("lets marks fade after their time is up", async () => {
    const { roomCode, list } = await crewAtSea(1);
    await list[0].must("map:mark", { kind: "pin", points: [{ x: 5, y: 5 }] });
    expect(marks.marksOf(roomCode)).toHaveLength(1);
    clock += CLIENT_LIMITS.ttlMs + 1;
    expect(marks.marksOf(roomCode)).toHaveLength(0);
  });
});
