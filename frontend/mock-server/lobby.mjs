// Development stub of the Phase 1 lobby protocol (see src/lib/socket/contract.ts).
// It implements crew/room lifecycle only — no game rules. Replace with the real backend.
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT ?? 4000);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const AVATARS = new Set([
  "captain", "corsair", "navigator", "gunner", "sea-witch", "quartermaster", "old-salt", "powder-monkey",
]);
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const COUNTDOWN_SECONDS = 3;
const DISCONNECT_GRACE_MS = 30_000;

/** @type {Map<string, any>} */
const rooms = new Map();

const ok = (data) => ({ ok: true, data });
const fail = (code, message = code) => ({ ok: false, error: { code, message } });

function newCode() {
  let code;
  do {
    code = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  } while (rooms.has(code));
  return code;
}

const cleanName = (v, min, max) => {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim();
  return name.length >= min && name.length <= max ? name : null;
};

function playerSnapshot(p, room) {
  return {
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    isCaptain: room.captainId === p.id,
    isReady: p.isReady,
    isConnected: p.isConnected,
    joinedAt: p.joinedAt,
  };
}

function roomSnapshot(room) {
  return {
    code: room.code,
    crewName: room.crewName,
    phase: room.phase,
    captainId: room.captainId,
    players: [...room.players.values()].map((p) => playerSnapshot(p, room)),
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    createdAt: room.createdAt,
  };
}

function createPlayer(socket, name, avatarId) {
  return {
    id: randomUUID(),
    name,
    avatarId,
    isReady: false,
    isConnected: true,
    joinedAt: Date.now(),
    socketId: socket.id,
    sessionToken: randomBytes(18).toString("base64url"),
    dropTimer: null,
  };
}

const io = new Server(createServer().listen(PORT), { cors: { origin: true } });

function broadcastState(room) {
  io.to(room.code).emit("room:state", roomSnapshot(room));
}

function seat(socket, room, player) {
  socket.join(room.code);
  socket.data = { roomCode: room.code, playerId: player.id };
  return ok({ room: roomSnapshot(room), playerId: player.id, sessionToken: player.sessionToken });
}

function removePlayer(room, playerId, reason) {
  const player = room.players.get(playerId);
  if (!player) return;
  clearTimeout(player.dropTimer);
  room.players.delete(playerId);
  const s = io.sockets.sockets.get(player.socketId);
  if (s && s.data?.playerId === playerId) {
    s.leave(room.code);
    s.data = {};
  }

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  io.to(room.code).emit("room:player-left", { playerId, name: player.name, reason });
  if (reason === "kicked" && s) s.emit("room:player-left", { playerId, name: player.name, reason });
  if (room.captainId === playerId) {
    const next = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    room.captainId = next.id;
    io.to(room.code).emit("room:captain-changed", { captainId: next.id });
  }
  broadcastState(room);
}

function current(socket) {
  const { roomCode, playerId } = socket.data ?? {};
  const room = roomCode && rooms.get(roomCode);
  const player = room?.players.get(playerId);
  return room && player ? { room, player } : null;
}

io.on("connection", (socket) => {
  socket.on("crew:create", (payload, ack) => {
    const playerName = cleanName(payload?.playerName, 2, 16);
    const crewName = cleanName(payload?.crewName, 3, 24);
    if (!playerName || !crewName || !AVATARS.has(payload?.avatarId)) return ack(fail("INVALID_PAYLOAD"));

    const existing = current(socket);
    if (existing) removePlayer(existing.room, existing.player.id, "left");

    const player = createPlayer(socket, playerName, payload.avatarId);
    const room = {
      code: newCode(),
      crewName,
      phase: "lobby",
      captainId: player.id,
      players: new Map([[player.id, player]]),
      createdAt: Date.now(),
    };
    rooms.set(room.code, room);
    ack(seat(socket, room, player));
    console.log(`[mock] ${playerName} founded ${crewName} (${room.code})`);
  });

  socket.on("crew:join", (payload, ack) => {
    const playerName = cleanName(payload?.playerName, 2, 16);
    const code = typeof payload?.roomCode === "string" ? payload.roomCode.toUpperCase() : "";
    if (!playerName || !AVATARS.has(payload?.avatarId)) return ack(fail("INVALID_PAYLOAD"));

    const room = rooms.get(code);
    if (!room) return ack(fail("ROOM_NOT_FOUND"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (room.players.size >= MAX_PLAYERS) return ack(fail("ROOM_FULL"));
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === playerName.toLowerCase());
    if (taken) return ack(fail("NAME_TAKEN"));

    const existing = current(socket);
    if (existing) removePlayer(existing.room, existing.player.id, "left");

    const player = createPlayer(socket, playerName, payload.avatarId);
    room.players.set(player.id, player);
    ack(seat(socket, room, player));
    socket.to(room.code).emit("room:player-joined", { player: playerSnapshot(player, room) });
    broadcastState(room);
  });

  socket.on("crew:rejoin", (payload, ack) => {
    const room = rooms.get(String(payload?.roomCode ?? "").toUpperCase());
    const player = room && [...room.players.values()].find((p) => p.sessionToken === payload?.sessionToken);
    if (!room || !player) return ack(fail("SESSION_EXPIRED"));

    clearTimeout(player.dropTimer);
    player.socketId = socket.id;
    player.isConnected = true;
    ack(seat(socket, room, player));
    socket.to(room.code).emit("room:player-updated", { player: playerSnapshot(player, room) });
    broadcastState(room);
  });

  socket.on("crew:leave", (_payload, ack) => {
    const ctx = current(socket);
    if (ctx) removePlayer(ctx.room, ctx.player.id, "left");
    ack(ok(null));
  });

  socket.on("player:ready", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    if (ctx.room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    ctx.player.isReady = Boolean(payload?.ready);
    const snapshot = playerSnapshot(ctx.player, ctx.room);
    ack(ok(snapshot));
    io.to(ctx.room.code).emit("room:player-updated", { player: snapshot });
    broadcastState(ctx.room);
  });

  socket.on("game:start", (_payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;
    if (room.captainId !== player.id) return ack(fail("NOT_CAPTAIN"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (room.players.size < MIN_PLAYERS) return ack(fail("NOT_ENOUGH_PLAYERS"));
    if ([...room.players.values()].some((p) => !p.isReady)) return ack(fail("PLAYERS_NOT_READY"));

    room.phase = "starting";
    ack(ok(null));
    io.to(room.code).emit("game:starting", {
      startsAt: Date.now() + COUNTDOWN_SECONDS * 1000,
      seconds: COUNTDOWN_SECONDS,
    });
    broadcastState(room);
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.phase = "in-game";
      io.to(room.code).emit("game:started", { roomCode: room.code });
      broadcastState(room);
    }, COUNTDOWN_SECONDS * 1000 + 400);
  });

  socket.on("disconnect", () => {
    const ctx = current(socket);
    if (!ctx) return;
    const { room, player } = ctx;
    if (player.socketId !== socket.id) return;
    player.isConnected = false;
    io.to(room.code).emit("room:player-updated", { player: playerSnapshot(player, room) });
    broadcastState(room);
    player.dropTimer = setTimeout(() => removePlayer(room, player.id, "disconnected"), DISCONNECT_GRACE_MS);
  });
});

console.log(`[mock] Pirate Protocol lobby stub listening on http://localhost:${PORT}`);
