// Map marks for the practice harbour (see src/lib/socket/marks.ts for the protocol).
// Attach to any socket.io server:
//
//   import { attachMapMarks } from "./marks.mjs";
//   const marks = attachMapMarks(io, {
//     seatOf: (socket) => {                       // who is this socket, and may they mark?
//       const ctx = current(socket);
//       return ctx ? { roomCode: ctx.room.code, playerId: ctx.player.id, canMark: ctx.room.phase === "in-game" } : null;
//     },
//   });
//   // after a successful join/rejoin:   marks.sendTo(socket, room.code)
//   // when a room is deleted:           marks.forgetRoom(room.code)
//
// The server owns ids, ownership, limits and expiry. Clients only ever receive the full list.
import { randomUUID } from "node:crypto";

export const MARK_KINDS = new Set(["pin", "danger", "treasure", "route"]);
export const MARK_LIMITS = Object.freeze({
  perSailor: 6,
  routePoints: 24,
  minRouteLength: 4,
  ttlMs: 180_000,
  perMinute: 24,
});

const quantize = (n) => Math.round(Math.min(100, Math.max(0, n)) * 2) / 2;
const isPoint = (v) => v && typeof v === "object" && Number.isFinite(v.x) && Number.isFinite(v.y);

function routeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Same rules as cleanMarkRequest in src/lib/socket/marks.ts; the server never trusts the client's copy. */
export function cleanMarkRequest(input) {
  if (!input || typeof input !== "object") return null;
  const { kind, points } = input;
  if (typeof kind !== "string" || !MARK_KINDS.has(kind)) return null;
  if (!Array.isArray(points) || points.length === 0 || !points.every(isPoint)) return null;
  const cleaned = points.map((p) => ({ x: quantize(p.x), y: quantize(p.y) }));
  if (kind !== "route") return cleaned.length === 1 ? { kind, points: cleaned } : null;
  if (cleaned.length < 2 || cleaned.length > MARK_LIMITS.routePoints) return null;
  if (routeLength(cleaned) < MARK_LIMITS.minRouteLength) return null;
  return { kind, points: cleaned };
}

const ok = (data) => ({ ok: true, data });
const fail = (code, message = code) => ({ ok: false, error: { code, message } });

/**
 * @param {import("socket.io").Server} io
 * @param {{ seatOf: (socket: import("socket.io").Socket) => ({ roomCode: string, playerId: string, canMark: boolean } | null), now?: () => number }} options
 */
export function attachMapMarks(io, { seatOf, now = () => Date.now() }) {
  /** @type {Map<string, any[]>} roomCode → marks */
  const rooms = new Map();
  /** @type {WeakMap<object, number[]>} socket → recent request times */
  const recent = new WeakMap();

  const live = (roomCode) => {
    const t = now();
    const marks = (rooms.get(roomCode) ?? []).filter((m) => m.expiresAt > t).sort((a, b) => a.createdAt - b.createdAt);
    if (marks.length) rooms.set(roomCode, marks);
    else rooms.delete(roomCode);
    return marks;
  };

  const broadcast = (roomCode) => io.to(roomCode).emit("map:marks", { marks: live(roomCode) });

  const allow = (socket) => {
    const t = now();
    const times = (recent.get(socket) ?? []).filter((at) => t - at < 60_000);
    if (times.length >= MARK_LIMITS.perMinute) {
      recent.set(socket, times);
      return false;
    }
    times.push(t);
    recent.set(socket, times);
    return true;
  };

  const guard = (socket, ack) => {
    if (typeof ack !== "function") return null;
    const seat = seatOf(socket);
    let refusal = null;
    if (!seat) refusal = fail("NOT_IN_ROOM");
    else if (!seat.canMark) refusal = fail("NOT_ALLOWED", "Marks can only be inked while at sea.");
    else if (!allow(socket)) refusal = fail("RATE_LIMITED", "Easy on the ink, sailor.");
    if (refusal) {
      ack(refusal);
      return null;
    }
    return seat;
  };

  io.on("connection", (socket) => {
    socket.on("map:mark", (payload, ack) => {
      const seat = guard(socket, ack);
      if (!seat) return;
      const clean = cleanMarkRequest(payload);
      if (!clean) return ack(fail("INVALID_PAYLOAD"));

      const t = now();
      const mark = { id: randomUUID(), playerId: seat.playerId, ...clean, createdAt: t, expiresAt: t + MARK_LIMITS.ttlMs };
      const marks = live(seat.roomCode);
      const mine = marks.filter((m) => m.playerId === seat.playerId);
      const retire = new Set(mine.slice(0, Math.max(0, mine.length - MARK_LIMITS.perSailor + 1)).map((m) => m.id));
      rooms.set(seat.roomCode, [...marks.filter((m) => !retire.has(m.id)), mark]);
      ack(ok(mark));
      broadcast(seat.roomCode);
    });

    socket.on("map:unmark", (payload, ack) => {
      const seat = guard(socket, ack);
      if (!seat) return;
      const markId = typeof payload?.markId === "string" ? payload.markId : "";
      const marks = live(seat.roomCode);
      const target = marks.find((m) => m.id === markId);
      if (!target) return ack(fail("NOT_FOUND"));
      if (target.playerId !== seat.playerId) return ack(fail("NOT_ALLOWED", "That ink isn't yours to wipe."));
      rooms.set(seat.roomCode, marks.filter((m) => m.id !== markId));
      ack(ok(null));
      broadcast(seat.roomCode);
    });
  });

  // Expired marks fade on their own; push the shorter list so every chart agrees.
  const sweep = setInterval(() => {
    const t = now();
    for (const [code, marks] of rooms) if (marks.some((m) => m.expiresAt <= t)) broadcast(code);
  }, 5_000);
  sweep.unref?.();

  return {
    sendTo(socket, roomCode) {
      socket.emit("map:marks", { marks: live(roomCode) });
    },
    forgetRoom(roomCode) {
      rooms.delete(roomCode);
    },
    marksOf(roomCode) {
      return live(roomCode);
    },
    stop() {
      clearInterval(sweep);
    },
  };
}
