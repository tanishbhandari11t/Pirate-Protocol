import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { MapMark, MarksPush, SeatGrant } from "@/lib/socket/contract";
import { sailors, startMockServer, type MockServer, type Sailor } from "./harness";

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

async function crewAtSea() {
  const [anne, jack] = await sailors(server.url, "anne", "jack");
  open.push(anne, jack);
  const seat = await anne.must<SeatGrant>("crew:create", { playerName: "Anne", crewName: "The Black Gull", avatarId: "captain" });
  const jackSeat = await jack.must<SeatGrant>("crew:join", { playerName: "Jack", roomCode: seat.room.code, avatarId: "corsair" });
  return { anne, jack, code: seat.room.code, anneId: seat.playerId, jackSeat };
}

async function setSail(anne: Sailor, jack: Sailor) {
  await Promise.all([anne, jack].map((s) => s.must("player:ready", { ready: true })));
  await anne.must("game:start");
  await Promise.all([anne, jack].map((s) => s.waitFor("game:started", () => true, 6_000)));
}

describe("map marks through the lobby server", () => {
  it("refuses ink while still in harbour", async () => {
    const { anne } = await crewAtSea();
    expect(await anne.request("map:mark", { kind: "pin", points: [{ x: 10, y: 10 }] })).toMatchObject({
      ok: false,
      error: { code: "NOT_ALLOWED" },
    });
  });

  it("relays marks between crewmates once at sea and restores them on rejoin", async () => {
    const { anne, jack, code, anneId, jackSeat } = await crewAtSea();
    await setSail(anne, jack);

    const mark = await anne.must<MapMark>("map:mark", { kind: "treasure", points: [{ x: 42, y: 30 }] });
    expect(mark.playerId).toBe(anneId);
    const seen = await jack.waitFor<MarksPush>("map:marks", (p) => p.marks.length === 1);
    expect(seen.marks[0]).toMatchObject({ id: mark.id, kind: "treasure", points: [{ x: 42, y: 30 }] });

    expect(await jack.request("map:unmark", { markId: mark.id })).toMatchObject({ ok: false, error: { code: "NOT_ALLOWED" } });

    jack.close();
    const [back] = await sailors(server.url, "jack-again");
    open.push(back);
    await back.must("crew:rejoin", { roomCode: code, sessionToken: jackSeat.sessionToken });
    const restored = await back.waitFor<MarksPush>("map:marks");
    expect(restored.marks.map((m) => m.id)).toEqual([mark.id]);
  }, 12_000);
});
