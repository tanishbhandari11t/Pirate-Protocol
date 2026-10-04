// Captain's Gambit: a quick dice duel between two sailors of the same crew. The server rolls every
// die; clients only ever display what they are sent. Stakes are honour alone (no cargo changes
// hands), so it never competes with the trading rules.
//
//   client → server  "gambit:challenge"  { toPlayerId }        ack → GambitDuel
//   client → server  "gambit:respond"    { duelId, accept }    ack → GambitDuel
//   server → client  "gambit:update"     GambitDuel            to both duellists, on every change
//
// Attach to any socket.io server:
//
//   const gambit = attachGambit(io, { seatOf: (socket) => ({ roomCode, playerId }) | null, socketOf: (playerId) => socket | null });
import { randomInt, randomUUID } from "node:crypto";

export const GAMBIT_RULES = Object.freeze({
  dicePerRoll: 3,
  roundsToWin: 2,
  maxRounds: 5,
  answerWindowMs: 30_000,
  roundGapMs: 1_400,
  cooldownMs: 3_000,
});

const ok = (data) => ({ ok: true, data });
const fail = (code, message = code) => ({ ok: false, error: { code, message } });
const roll = () => Array.from({ length: GAMBIT_RULES.dicePerRoll }, () => randomInt(1, 7));
const sum = (dice) => dice.reduce((a, b) => a + b, 0);

/**
 * @param {import("socket.io").Server} io
 * @param {{ seatOf: (socket: import("socket.io").Socket) => ({ roomCode: string, playerId: string } | null), now?: () => number, roundGapMs?: number }} options
 */
export function attachGambit(io, { seatOf, now = () => Date.now(), roundGapMs = GAMBIT_RULES.roundGapMs }) {
  /** @type {Map<string, any>} duelId → duel */
  const duels = new Map();
  /** @type {Map<string, number>} playerId → epoch ms of their last request */
  const lastAsk = new Map();

  const publicDuel = (d) => ({
    id: d.id,
    roomCode: d.roomCode,
    challengerId: d.challengerId,
    defenderId: d.defenderId,
    status: d.status,
    rounds: d.rounds.map((r) => ({ ...r, challenger: [...r.challenger], defender: [...r.defender] })),
    winnerId: d.winnerId,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
  });

  const activeFor = (playerId) =>
    [...duels.values()].find((d) => (d.status === "pending" || d.status === "rolling") && (d.challengerId === playerId || d.defenderId === playerId));

  const push = (d) => {
    for (const s of io.sockets.sockets.values()) {
      const seat = seatOf(s);
      if (seat && seat.roomCode === d.roomCode && (seat.playerId === d.challengerId || seat.playerId === d.defenderId)) {
        s.emit("gambit:update", publicDuel(d));
      }
    }
  };

  const finish = (d) => {
    clearTimeout(d.timer);
    setTimeout(() => duels.delete(d.id), 60_000).unref?.();
  };

  const playRound = (d) => {
    if (d.status !== "rolling") return;
    const challenger = roll();
    const defender = roll();
    const a = sum(challenger);
    const b = sum(defender);
    d.rounds.push({ challenger, defender, winner: a === b ? null : a > b ? "challenger" : "defender" });
    const wins = (side) => d.rounds.filter((r) => r.winner === side).length;
    if (wins("challenger") >= GAMBIT_RULES.roundsToWin) d.winnerId = d.challengerId;
    else if (wins("defender") >= GAMBIT_RULES.roundsToWin) d.winnerId = d.defenderId;
    if (d.winnerId || d.rounds.length >= GAMBIT_RULES.maxRounds) {
      d.status = "done";
      push(d);
      finish(d);
      return;
    }
    push(d);
    d.timer = setTimeout(() => playRound(d), roundGapMs);
  };

  io.on("connection", (socket) => {
    socket.on("gambit:challenge", (payload, ack) => {
      if (typeof ack !== "function") return;
      const seat = seatOf(socket);
      if (!seat) return ack(fail("NOT_IN_ROOM"));
      const t = now();
      if (t - (lastAsk.get(seat.playerId) ?? 0) < GAMBIT_RULES.cooldownMs) return ack(fail("RATE_LIMITED", "Catch your breath before the next wager."));
      const toPlayerId = typeof payload?.toPlayerId === "string" ? payload.toPlayerId : "";
      if (!toPlayerId || toPlayerId === seat.playerId) return ack(fail("INVALID_PAYLOAD"));
      const rival = [...io.sockets.sockets.values()].map(seatOf).find((s) => s && s.roomCode === seat.roomCode && s.playerId === toPlayerId);
      if (!rival) return ack(fail("BAD_RECIPIENT", "That sailor isn't at the table."));
      if (activeFor(seat.playerId) || activeFor(toPlayerId)) return ack(fail("NOT_ALLOWED", "One of you is already mid-wager."));

      lastAsk.set(seat.playerId, t);
      const duel = {
        id: randomUUID(),
        roomCode: seat.roomCode,
        challengerId: seat.playerId,
        defenderId: toPlayerId,
        status: "pending",
        rounds: [],
        winnerId: null,
        createdAt: t,
        expiresAt: t + GAMBIT_RULES.answerWindowMs,
        timer: null,
      };
      duel.timer = setTimeout(() => {
        if (duel.status !== "pending") return;
        duel.status = "expired";
        push(duel);
        finish(duel);
      }, GAMBIT_RULES.answerWindowMs);
      duel.timer.unref?.();
      duels.set(duel.id, duel);
      ack(ok(publicDuel(duel)));
      push(duel);
    });

    socket.on("gambit:respond", (payload, ack) => {
      if (typeof ack !== "function") return;
      const seat = seatOf(socket);
      if (!seat) return ack(fail("NOT_IN_ROOM"));
      const duel = duels.get(typeof payload?.duelId === "string" ? payload.duelId : "");
      if (!duel || duel.roomCode !== seat.roomCode) return ack(fail("NOT_FOUND"));
      if (duel.defenderId !== seat.playerId) return ack(fail("NOT_ALLOWED", "That wager wasn't offered to you."));
      if (duel.status !== "pending") return ack(fail("NOT_FOUND", "That wager is no longer on the table."));
      clearTimeout(duel.timer);
      if (payload?.accept !== true) {
        duel.status = "declined";
        ack(ok(publicDuel(duel)));
        push(duel);
        finish(duel);
        return;
      }
      duel.status = "rolling";
      ack(ok(publicDuel(duel)));
      push(duel);
      duel.timer = setTimeout(() => playRound(duel), roundGapMs);
    });
  });

  return {
    /** Ends any duel involving this sailor, e.g. when they leave the crew. */
    forfeit(playerId) {
      const duel = activeFor(playerId);
      if (!duel) return;
      duel.status = "expired";
      push(duel);
      finish(duel);
    },
    duelsOf(roomCode) {
      return [...duels.values()].filter((d) => d.roomCode === roomCode).map(publicDuel);
    },
  };
}
