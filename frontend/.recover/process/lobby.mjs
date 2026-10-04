// Development server for the Pirate Protocol wire contract (see src/lib/socket/contract.ts).
//
// Phase 1 — crews & lobby:  crew:create / crew:join / crew:rejoin / crew:leave / crew:kick,
//                           crew:configure, player:ready, game:start and the room:* pushes.
// Phase 2 — the voyage:     map:move, puzzle:submit, trade:offer, game:event, game:finished
//                           and an enriched room:state that carries the voyage plus `you`.
// Phase 3 — crew life:      chat:send, puzzle:hint, spectate:follow, voyage:sync, the voyage
//                           clock and the scoreboard.
//
// This server is authoritative, exactly like the NestJS backend it stands in for: answers are
// stored only as salted hashes, hints never leave the server unless bought, verdicts and scores
// are decided here, and the client renders whatever it is told. Nothing in this file is ever
// bundled into the browser.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? true;
const LOG_LEVEL = process.env.MOCK_LOG ?? "info";
/** Per-boot pepper for answer hashes. Never logged, never sent to a client. */
const PEPPER = process.env.MOCK_ANSWER_PEPPER ?? randomBytes(24).toString("hex");

const PROTOCOL_VERSION = 3;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const AVATARS = new Set([
  "captain", "corsair", "navigator", "gunner", "sea-witch", "quartermaster", "old-salt", "powder-monkey",
]);
const PLAYER_NAME = { min: 2, max: 16 };
const CREW_NAME = { min: 3, max: 24 };

/** Outfit pieces, mirrored from `contract.ts`. Purely cosmetic: the server only checks they exist. */
const OUTFIT = {
  hat: new Set(["tricorn", "bicorne", "bandana", "knit", "hood", "plumed", "skull-cap", "crown"]),
  coat: new Set(["crimson", "midnight", "kelp", "ash", "royal", "gilded"]),
  face: new Set(["eyepatch", "monocle", "scar", "warpaint"]),
  trinket: new Set(["parrot", "pipe", "gold-tooth", "hoops", "medal"]),
  frame: new Set(["rope", "brass", "silver", "gold", "legend"]),
};
const FLAG = {
  field: new Set(["sable", "crimson", "navy", "bone", "emerald", "royal"]),
  emblem: new Set(["skull", "crossed-swords", "anchor", "compass", "kraken", "hourglass", "serpent", "crown"]),
  border: new Set(["plain", "tattered", "gilded"]),
};
const DEFAULT_OUTFIT = {
  hat: null,
  coat: null,
  face: null,
  trinket: null,
  frame: null,
  flag: { field: "sable", emblem: "skull", border: "plain" },
};
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const COUNTDOWN_SECONDS = 3;
const DISCONNECT_GRACE_MS = 30_000;
const ANSWER_MAX = 80;
const VOYAGE_LOG_LIMIT = 60;
const WRONG_ANSWER_COOLDOWN_MS = 1_500;
const IDLE_ROOM_MS = 10 * 60_000;
const FINISHED_ROOM_MS = 30 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

const CHAT_MAX = 200;
const CHAT_HISTORY_LIMIT = 100;
const CHAT_REPEAT_WINDOW_MS = 3_000;

const STRIKE_LIMIT = { min: 1, max: 5 };
const TIME_LIMIT_OPTIONS = [0, 10, 15, 20, 30];
const DEFAULT_SETTINGS = { maxStrikes: 3, trapsEnabled: true, hintsEnabled: true, timeLimitMinutes: 0 };
/** Minutes before the end of a timed voyage at which the crew is warned. */
const TIME_WARNINGS = [5, 1];

const SCORE_RULES = {
  perSolve: 100,
  perRelic: 50,
  perStrike: -40,
  perHint: -25,
  treasure: 500,
  perMinuteSpare: 10,
};
/** Untimed voyages still reward speed: every minute under this counts as spare. */
const PAR_MINUTES = 30;

const START_ISLAND_KEY = "port-royal";
const VAULT_ISLAND_KEY = "the-vault";
const REQUIRED_RELICS = ["compass", "spyglass", "serpent-key", "widow-chart", "gold-seal"];
const TRADABLE_ITEMS = new Set(["tide-rumor", "cursed-coin"]);
const CURSED_COIN = "cursed-coin";
const TIDE_RUMOR = "tide-rumor";
const HINT_PAYMENTS = new Set(["strike", "tide-rumor"]);

const QUICK_CALLS = {
  "land-ho": "Land ho!",
  "trap-ahead": "Trap ahead — tread carefully!",
  "need-help": "I need a hand with this riddle.",
  "on-my-way": "Setting sail — on my way.",
  "got-relic": "Relic secured!",
  "trade-me": "Anyone got something to trade?",
  "well-done": "Fine work, sailor!",
  aye: "Aye aye!",
};

/** Masked rather than rejected, so a heated sailor still gets the gist across. */
const BANNED_WORDS = ["fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "slut", "whore"];
const BANNED_PATTERN = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\w*`, "gi");

/* ------------------------------------------------------------------ */
/* Logging                                                             */
/* ------------------------------------------------------------------ */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function log(level, message, extra) {
  if (LEVELS[level] < (LEVELS[LOG_LEVEL] ?? LEVELS.info)) return;
  const stamp = new Date().toISOString().slice(11, 23);
  const line = `[mock ${stamp}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra === undefined) out(line);
  else out(line, extra);
}

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

/** Lower-case, strip punctuation, collapse whitespace. "  Pirate-Protocol! " → "pirate protocol". */
function normalizeAnswer(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashAnswer(value) {
  return createHash("sha256").update(`${PEPPER}:${normalizeAnswer(value)}`).digest();
}

function answerMatches(candidate, storedHash) {
  const attempt = hashAnswer(candidate);
  return attempt.length === storedHash.length && timingSafeEqual(attempt, storedHash);
}

/* ------------------------------------------------------------------ */
/* Catalog — mirrors the backend seed                                   */
/* ------------------------------------------------------------------ */

const ITEMS = {
  compass: { name: "Brass Compass", description: "Needle swings toward the next lie." },
  spyglass: { name: "Blackreef Spyglass", description: "Shows the reef as it was, not as it is." },
  "serpent-key": { name: "Serpent Key", description: "A fang filed into a key." },
  "widow-chart": { name: "Widow's Chart", description: "Courses drawn in salt." },
  "gold-seal": { name: "Goldmouth Seal", description: "Opens a mouth that should stay shut." },
  "tide-rumor": { name: "Tide Rumor", description: "A scrap of hearsay. Safe to trade." },
  "cursed-coin": { name: "Cursed Coin", description: "Warm to the touch. Safe to trade, unwise to keep." },
  "treasure-chest": { name: "Protocol Chest", description: "The hoard at the end of the map." },
};

/**
 * Raw seed. `answer` is consumed once at boot to build a hash and then dropped, so the plain text
 * never lives on a room object and can never leak into a snapshot by accident. Hints are ordered
 * from gentle to generous and are only ever sent to the sailor who pays for them.
 */
const SEED = [
  {
    key: "port-royal", name: "Port Royal", x: 12, y: 70, order: 1, kind: "NORMAL",
    description: "The last honest dock on a dishonest sea. Voyages are counted here, then forgotten.",
    puzzles: [{
      key: "port-royal-map", cipher: "riddle", answer: "map", reward: "compass",
      prompt: "I show every shore and none of the sea's depth. Sailors fold me until I tear. What am I?",
      hints: ["It is drawn on paper or parchment.", "Every captain unrolls one before a voyage."],
    }],
  },
  {
    key: "blackreef", name: "Blackreef", x: 28, y: 48, order: 2, kind: "NORMAL",
    description: "Stone teeth under black water. The old signal fire still spells a word nobody says aloud.",
    puzzles: [{
      key: "blackreef-cipher", cipher: "caesar", answer: "treasure", reward: "spyglass",
      prompt: "Each letter was moved 3 places forward in the alphabet. Decode: wuhdvxuh",
      hints: ["Move every letter three places back: w becomes t.", "It is the thing every pirate hunts."],
    }],
  },
  {
    key: "serpent-cay", name: "Serpent Cay", x: 46, y: 62, order: 3, kind: "NORMAL",
    description: "A coil of sand that shifts when the moon is insulted.",
    puzzles: [{
      key: "serpent-anagram", cipher: "anagram", answer: "serpent", reward: "serpent-key",
      prompt: "The cay hisses a scrambled name. Rearrange: PENREST",
      hints: ["The answer is a creature with no legs.", "The cay is named after it."],
    }],
  },
  {
    key: "deadmans-shelf", name: "Deadman's Shelf", x: 40, y: 30, order: 4, kind: "TRAP",
    description: "A chest sits in the open, which is how you know it is not a gift.",
    puzzles: [{
      key: "deadman-plaque", cipher: "choice", answer: "leave", reward: null, trapOnFail: true,
      prompt: "The plaque reads DO NOT OPEN. The only safe order is a single word. What do you do?",
      hints: ["Greed is the trap here.", "Do the opposite of staying to open it."],
    }],
  },
  {
    key: "widows-rock", name: "Widow's Rock", x: 63, y: 44, order: 5, kind: "NORMAL",
    description: "Charts nailed to the cliff so the wind can argue with them.",
    puzzles: [{
      key: "widow-riddle", cipher: "riddle", answer: "silence", reward: "widow-chart",
      prompt: "What vanishes the moment you speak its name?",
      hints: ["You cannot hear it.", "Libraries ask you to keep it."],
    }],
  },
  {
    key: "kraken-shoal", name: "Kraken Shoal", x: 72, y: 68, order: 6, kind: "TRAP",
    description: "The water here has too many elbows.",
    puzzles: [{
      key: "kraken-arms", cipher: "choice", answer: "0", reward: "tide-rumor", trapOnFail: true,
      prompt: "A kraken shows eight arms. How many will you grasp? Answer with a digit.",
      hints: ["Every arm you grasp grasps you back.", "The safest number is none at all."],
    }],
  },
  {
    key: "goldmouth", name: "Goldmouth", x: 80, y: 28, order: 7, kind: "NORMAL",
    description: "A cave that pays in echoes and collects in blood.",
    puzzles: [{
      key: "goldmouth-tides", cipher: "riddle", answer: "four", reward: "gold-seal",
      prompt: "Two high, two low. How many tides mark a day? Answer with the number-word.",
      hints: ["Count both highs and both lows.", "Spell the number out in letters."],
    }],
  },
  {
    key: "the-vault", name: "The Vault", x: 90, y: 14, order: 8, kind: "TREASURE",
    description: "Not buried. Waiting. The door listens for five relics and one protocol.",
    puzzles: [{
      key: "vault-protocol", cipher: "token", answer: "pirate protocol", reward: "treasure-chest",
      prompt: "The door counts five relics, then asks the name of this hunt. Two words.",
      hints: ["Look at the title above your map.", "It is the name of this very game."],
    }],
  },
];

const ISLANDS = SEED.map((island) => ({
  id: `isl_${island.key}`,
  key: island.key,
  name: island.name,
  description: island.description,
  x: island.x,
  y: island.y,
  order: island.order,
  kind: island.kind,
  puzzles: island.puzzles.map((p, i) => ({
    id: `puz_${p.key}`,
    key: p.key,
    prompt: p.prompt,
    cipher: p.cipher,
    order: i + 1,
    reward: p.reward,
    trapOnFail: Boolean(p.trapOnFail),
    hints: [...p.hints],
    answerHash: hashAnswer(p.answer),
  })),
}));

const ISLAND_BY_KEY = new Map(ISLANDS.map((i) => [i.key, i]));
const PUZZLE_BY_KEY = new Map(ISLANDS.flatMap((i) => i.puzzles.map((p) => [p.key, { puzzle: p, island: i }])));

for (const relic of REQUIRED_RELICS) {
  if (!ITEMS[relic]) throw new Error(`Catalog is missing relic ${relic}`);
}
for (const { puzzle } of PUZZLE_BY_KEY.values()) {
  if (puzzle.hints.length === 0) throw new Error(`Puzzle ${puzzle.key} has no hints`);
}

/* ------------------------------------------------------------------ */
/* Acks & errors                                                       */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES = {
  INVALID_PAYLOAD: "That order made no sense to the harbour master.",
  ROOM_NOT_FOUND: "No ship sails under that code.",
  ROOM_FULL: "That ship has no berths left.",
  GAME_IN_PROGRESS: "That ship has already weighed anchor.",
  NAME_TAKEN: "A sailor by that name is already aboard.",
  NOT_IN_ROOM: "You are not aboard any ship.",
  NOT_CAPTAIN: "Only the captain may give that order.",
  NOT_ENOUGH_PLAYERS: "The ship needs more hands.",
  PLAYERS_NOT_READY: "Not every sailor is ready.",
  SESSION_EXPIRED: "Your berth was given away.",
  RATE_LIMITED: "Slow down, sailor.",
  NOT_SAILING: "The voyage has not begun.",
  VOYAGE_OVER: "The voyage is over.",
  ISLAND_NOT_FOUND: "No such island on the chart.",
  ISLAND_HIDDEN: "That shore will not reveal itself yet.",
  PUZZLE_NOT_FOUND: "No such riddle on this chart.",
  NOT_ON_ISLAND: "You must drop anchor there first.",
  ALREADY_SOLVED: "You have already cracked that one.",
  ELIMINATED: "The sea has claimed you. Watch from the rigging.",
  MISSING_RELICS: "The Vault demands all five relics in your own pack.",
  NOT_TRADABLE: "That cannot change hands.",
  ITEM_NOT_HELD: "You do not hold that.",
  BAD_RECIPIENT: "That sailor cannot take it.",
  HINTS_DISABLED: "Hints are forbidden on this voyage.",
  NO_HINTS_LEFT: "No more hints for that riddle.",
  CANNOT_AFFORD: "You cannot pay that price.",
  NOT_SPECTATOR: "Only claimed sailors may watch another.",
  INTERNAL: "The harbour master dropped the ledger. Try again.",
};

const ok = (data) => ({ ok: true, data });
const fail = (code, message) => ({ ok: false, error: { code, message: message ?? ERROR_MESSAGES[code] ?? code } });

/* ------------------------------------------------------------------ */
/* Rate limiting — a small token bucket per socket and event           */
/* ------------------------------------------------------------------ */

const LIMITS = {
  "crew:create": { burst: 3, perSecond: 0.2 },
  "crew:join": { burst: 5, perSecond: 0.5 },
  "crew:rejoin": { burst: 5, perSecond: 1 },
  "crew:leave": { burst: 3, perSecond: 0.5 },
  "crew:kick": { burst: 3, perSecond: 0.5 },
  "crew:configure": { burst: 6, perSecond: 1 },
  "player:ready": { burst: 6, perSecond: 2 },
  "game:start": { burst: 3, perSecond: 0.5 },
  "map:move": { burst: 6, perSecond: 2 },
  "puzzle:submit": { burst: 4, perSecond: 1 },
  "puzzle:hint": { burst: 3, perSecond: 0.5 },
  "trade:offer": { burst: 4, perSecond: 1 },
  "spectate:follow": { burst: 5, perSecond: 1 },
  "chat:send": { burst: 5, perSecond: 0.7 },
  "voyage:sync": { burst: 4, perSecond: 1 },
};

function takeToken(socket, event) {
  const rule = LIMITS[event];
  if (!rule) return true;
  const buckets = (socket.data.buckets ??= {});
  const now = Date.now();
  const bucket = (buckets[event] ??= { tokens: rule.burst, at: now });
  bucket.tokens = Math.min(rule.burst, bucket.tokens + ((now - bucket.at) / 1000) * rule.perSecond);
  bucket.at = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const SETTING_KEYS = ["maxStrikes", "trapsEnabled", "hintsEnabled", "timeLimitMinutes"];

/** Same rules as `mergeSettings` in the contract. Unknown keys are ignored. */
function mergeSettings(current, patch) {
  const picked = {};
  for (const key of SETTING_KEYS) if (key in patch) picked[key] = patch[key];
  const next = { ...current, ...picked };
  if (!Number.isInteger(next.maxStrikes)) return null;
  if (next.maxStrikes < STRIKE_LIMIT.min || next.maxStrikes > STRIKE_LIMIT.max) return null;
  if (typeof next.trapsEnabled !== "boolean" || typeof next.hintsEnabled !== "boolean") return null;
  if (!TIME_LIMIT_OPTIONS.includes(next.timeLimitMinutes)) return null;
  return next;
}

function settingsEqual(a, b) {
  return SETTING_KEYS.every((k) => a[k] === b[k]);
}

function describeSettings(s) {
  return [
    `${s.maxStrikes} ${s.maxStrikes === 1 ? "strike" : "strikes"}`,
    s.trapsEnabled ? "traps armed" : "traps disarmed",
    s.hintsEnabled ? "hints for sale" : "no hints",
    s.timeLimitMinutes ? `${s.timeLimitMinutes}-minute clock` : "no clock",
  ].join(", ");
}

/* ------------------------------------------------------------------ */
/* Rooms & players                                                     */
/* ------------------------------------------------------------------ */

/** @type {Map<string, any>} */
const rooms = new Map();
const startedAt = Date.now();

function newCode() {
  let code;
  do {
    code = Array.from(randomBytes(ROOM_CODE_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join("");
  } while (rooms.has(code));
  return code;
}

const cleanName = (v, { min, max }) => {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim();
  return name.length >= min && name.length <= max ? name : null;
};

/** A clean copy of a client's outfit, `undefined` when none was sent, or `null` when it is malformed. */
function cleanOutfit(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || !value.flag || typeof value.flag !== "object") return null;
  const outfit = { flag: {} };
  for (const [slot, allowed] of Object.entries(OUTFIT)) {
    const piece = value[slot] ?? null;
    if (piece !== null && !allowed.has(piece)) return null;
    outfit[slot] = piece;
  }
  for (const [part, allowed] of Object.entries(FLAG)) {
    if (!allowed.has(value.flag[part])) return null;
    outfit.flag[part] = value.flag[part];
  }
  return outfit;
}

function createPlayer(socket, name, avatarId, outfit = DEFAULT_OUTFIT) {
  return {
    id: randomUUID(),
    name,
    avatarId,
    outfit,
    isReady: false,
    isConnected: true,
    joinedAt: Date.now(),
    socketId: socket.id,
    sessionToken: randomBytes(18).toString("base64url"),
    dropTimer: null,
    lastChat: null,
  };
}

function createRoom(crewName, captain) {
  const now = Date.now();
  return {
    code: newCode(),
    crewName,
    phase: "lobby",
    captainId: captain.id,
    players: new Map([[captain.id, captain]]),
    createdAt: now,
    lastActivityAt: now,
    settings: { ...DEFAULT_SETTINGS },
    startTimer: null,
    voyage: null,
    outbox: [],
    pendingFinish: false,
    chat: [],
    chatSeq: 0,
  };
}

function playerSnapshot(p, room) {
  return {
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    outfit: { ...p.outfit, flag: { ...p.outfit.flag } },
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
    settings: { ...room.settings },
    voyage: room.voyage ? voyageSnapshot(room) : null,
  };
}

function touch(room) {
  room.lastActivityAt = Date.now();
}

/* ------------------------------------------------------------------ */
/* Crew chat                                                           */
/* ------------------------------------------------------------------ */

function cleanChat(value) {
  if (typeof value !== "string") return { text: "", filtered: false };
  const collapsed = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX);
  let filtered = false;
  const text = collapsed.replace(BANNED_PATTERN, (word) => {
    filtered = true;
    return word[0] + "*".repeat(word.length - 1);
  });
  return { text, filtered };
}

function postChat(room, playerId, kind, text, { callId = null, filtered = false } = {}) {
  room.chatSeq += 1;
  const message = { id: randomUUID(), seq: room.chatSeq, playerId, kind, text, callId, sentAt: Date.now(), filtered };
  room.chat.push(message);
  if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);
  io.to(room.code).emit("chat:message", { ...message, roomCode: room.code });
  return message;
}

const systemChat = (room, text) => postChat(room, null, "system", text);

/* ------------------------------------------------------------------ */
/* Voyage engine                                                       */
/* ------------------------------------------------------------------ */

function createSailor(playerId) {
  return {
    playerId,
    currentIslandKey: START_ISLAND_KEY,
    strikes: 0,
    isEliminated: false,
    vaultAwakened: false,
    hintsUsed: 0,
    /** Hints bought, in purchase order. Private to this sailor. */
    hints: [],
    followingId: null,
    /** itemKey → quantity */
    inventory: new Map(),
    /** puzzleKey → epoch ms of the last wrong answer */
    lastWrongAt: new Map(),
  };
}

function startVoyage(room) {
  const now = Date.now();
  const minutes = room.settings.timeLimitMinutes;
  room.voyage = {
    status: "sailing",
    startedAt: now,
    endsAt: minutes ? now + minutes * 60_000 : null,
    finishedAt: null,
    finishReason: null,
    sailors: new Map([...room.players.keys()].map((id) => [id, createSailor(id)])),
    progress: [],
    discovered: new Set([START_ISLAND_KEY]),
    log: [],
    lastSeq: 0,
    winnerPlayerId: null,
    timers: [],
  };
  if (minutes) scheduleClock(room);
}

function scheduleClock(room) {
  const v = room.voyage;
  for (const minutesLeft of TIME_WARNINGS) {
    const delay = v.endsAt - minutesLeft * 60_000 - Date.now();
    if (delay <= 0) continue;
    v.timers.push(setTimeout(() => {
      if (!rooms.has(room.code) || v.status !== "sailing") return;
      record(room, "TIME_WARNING", null, { minutesLeft });
      systemChat(room, `${minutesLeft} ${minutesLeft === 1 ? "minute remains" : "minutes remain"} before the tide turns.`);
      broadcastState(room);
    }, delay));
  }
  v.timers.push(setTimeout(() => {
    if (!rooms.has(room.code) || v.status !== "sailing") return;
    record(room, "TIME_UP", null, {});
    const [first, second] = computeScores(room);
    const winner = first && first.score > 0 && (!second || second.rank !== first.rank) ? first.playerId : null;
    finishVoyage(room, winner, "time");
    systemChat(room, winner ? "The tide has turned. The best score takes the day." : "The tide has turned with no clear victor.");
    broadcastState(room);
    log("info", `${room.code} clock ran out`);
  }, v.endsAt - Date.now()));
}

function clearVoyageTimers(room) {
  for (const t of room.voyage?.timers ?? []) clearTimeout(t);
  if (room.voyage) room.voyage.timers = [];
}

/** Undiscovered shores keep their name and position but hide their lore and riddles. */
function publicIsland(island, discovered) {
  const seen = discovered.has(island.key);
  return {
    id: island.id,
    key: island.key,
    name: island.name,
    description: seen ? island.description : "Fog hides this shore.",
    x: island.x,
    y: island.y,
    order: island.order,
    kind: seen ? island.kind : "NORMAL",
    puzzles: seen
      ? island.puzzles.map(({ id, key, prompt, cipher, order, hints }) => ({
          id, key, prompt, cipher, order, hintCount: hints.length,
        }))
      : [],
  };
}

function sailorsAboard(room) {
  return [...room.voyage.sailors.values()].filter((s) => room.players.has(s.playerId));
}

function spareMinutes(v) {
  const end = v.finishedAt ?? Date.now();
  if (v.endsAt) return Math.max(0, Math.floor((v.endsAt - end) / 60_000));
  return Math.max(0, PAR_MINUTES - Math.floor((end - v.startedAt) / 60_000));
}

function computeScores(room) {
  const v = room.voyage;
  const rows = sailorsAboard(room).map((s) => {
    const solved = v.progress.filter((p) => p.playerId === s.playerId).length;
    const relics = REQUIRED_RELICS.filter((r) => (s.inventory.get(r) ?? 0) > 0).length;
    let score =
      solved * SCORE_RULES.perSolve +
      relics * SCORE_RULES.perRelic +
      s.strikes * SCORE_RULES.perStrike +
      s.hintsUsed * SCORE_RULES.perHint;
    if (v.finishReason === "treasure" && v.winnerPlayerId === s.playerId) {
      score += SCORE_RULES.treasure + spareMinutes(v) * SCORE_RULES.perMinuteSpare;
    }
    return { playerId: s.playerId, score, solved, relics, strikes: s.strikes, hintsUsed: s.hintsUsed, rank: 0 };
  });

  rows.sort((a, b) => b.score - a.score || b.solved - a.solved || a.strikes - b.strikes);
  let previous = null;
  rows.forEach((row, i) => {
    const tied = previous && previous.score === row.score && previous.solved === row.solved && previous.strikes === row.strikes;
    row.rank = tied ? previous.rank : i + 1;
    previous = row;
  });
  return rows;
}

function voyageSnapshot(room) {
  const v = room.voyage;
  return {
    status: v.status,
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    finishedAt: v.finishedAt,
    finishReason: v.finishReason,
    islands: ISLANDS.map((i) => publicIsland(i, v.discovered)),
    sailors: sailorsAboard(room).map(({ playerId, currentIslandKey, strikes, isEliminated, hintsUsed, followingId }) => ({
      playerId,
      currentIslandKey,
      strikes,
      isEliminated,
      hintsUsed,
      followingId,
    })),
    progress: v.progress.map((p) => ({ ...p })),
    discovered: [...v.discovered],
    log: v.log.map((e) => ({ ...e, payload: { ...e.payload } })),
    lastSeq: v.lastSeq,
    scores: computeScores(room),
    winnerPlayerId: v.winnerPlayerId,
  };
}

function inventoryOf(sailor) {
  if (!sailor) return [];
  return [...sailor.inventory.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([itemKey, quantity]) => ({
      itemKey,
      name: ITEMS[itemKey]?.name ?? itemKey,
      description: ITEMS[itemKey]?.description ?? "",
      quantity,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function grant(sailor, itemKey, quantity = 1) {
  sailor.inventory.set(itemKey, (sailor.inventory.get(itemKey) ?? 0) + quantity);
}

function take(sailor, itemKey, quantity = 1) {
  const left = (sailor.inventory.get(itemKey) ?? 0) - quantity;
  if (left > 0) sailor.inventory.set(itemKey, left);
  else sailor.inventory.delete(itemKey);
}

function holdsAllRelics(sailor) {
  return REQUIRED_RELICS.every((r) => (sailor.inventory.get(r) ?? 0) > 0);
}

function hasSolved(voyage, playerId, puzzleKey) {
  return voyage.progress.some((p) => p.playerId === playerId && p.puzzleKey === puzzleKey);
}

/** Records an event on the voyage log and queues it for delivery after the next state push. */
function record(room, type, playerId, payload = {}) {
  const v = room.voyage;
  v.lastSeq += 1;
  const event = { id: randomUUID(), seq: v.lastSeq, type, payload, playerId, createdAt: new Date().toISOString() };
  v.log.push(event);
  if (v.log.length > VOYAGE_LOG_LIMIT) v.log.splice(0, v.log.length - VOYAGE_LOG_LIMIT);
  room.outbox.push(event);
  log("debug", `${room.code} #${event.seq} ${type}`, payload);
  return event;
}

function discover(room, islandKey, playerId) {
  if (room.voyage.discovered.has(islandKey)) return false;
  room.voyage.discovered.add(islandKey);
  record(room, "ISLAND_DISCOVERED", playerId, { islandKey });
  return true;
}

function maybeAwakenVault(room, sailor) {
  if (sailor.vaultAwakened || !holdsAllRelics(sailor)) return;
  sailor.vaultAwakened = true;
  record(room, "VAULT_AWAKENED", sailor.playerId, {});
  discover(room, VAULT_ISLAND_KEY, sailor.playerId);
}

/** Ends the voyage. `game:finished` goes out with the next `broadcastState`, after the events. */
function finishVoyage(room, winnerPlayerId, reason) {
  const v = room.voyage;
  clearVoyageTimers(room);
  v.status = "finished";
  v.finishedAt = Date.now();
  v.finishReason = reason;
  v.winnerPlayerId = winnerPlayerId;
  room.phase = "finished";
  room.pendingFinish = true;
}

function activeSailors(room) {
  return sailorsAboard(room).filter((s) => !s.isEliminated);
}

/** If nobody is left standing, the crew is wrecked and the voyage ends without a winner. */
function checkWreck(room) {
  if (room.voyage.status !== "sailing" || activeSailors(room).length > 0) return;
  record(room, "CREW_WRECKED", null, {});
  finishVoyage(room, null, "wreck");
  systemChat(room, "The sea has claimed every sailor. No one reaches the Vault.");
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

const http = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const players = [...rooms.values()].reduce((n, r) => n + r.players.size, 0);
    const sailing = [...rooms.values()].filter((r) => r.voyage?.status === "sailing").length;
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({
      ok: true,
      protocol: PROTOCOL_VERSION,
      rooms: rooms.size,
      voyagesUnderSail: sailing,
      players,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    }));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Pirate Protocol mock server. Try /health.");
});

const io = new Server(http, { cors: { origin: CORS_ORIGIN } });

function socketsIn(room) {
  const ids = io.sockets.adapter.rooms.get(room.code) ?? new Set();
  return [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
}

/**
 * Sends every socket its own `room:state` (with its private hold and hints), then the queued
 * events in order, then `game:finished` if the voyage just ended.
 */
function broadcastState(room) {
  const snapshot = roomSnapshot(room);
  for (const s of socketsIn(room)) {
    const sailor = room.voyage?.sailors.get(s.data.playerId);
    s.emit("room:state", {
      ...snapshot,
      you: inventoryOf(sailor),
      yourHints: sailor ? sailor.hints.map((h) => ({ ...h })) : [],
    });
  }
  const events = room.outbox.splice(0);
  for (const event of events) io.to(room.code).emit("game:event", { ...event, roomCode: room.code });

  if (room.pendingFinish) {
    room.pendingFinish = false;
    io.to(room.code).emit("game:finished", {
      roomCode: room.code,
      winnerPlayerId: room.voyage.winnerPlayerId,
      finishedAt: room.voyage.finishedAt,
      reason: room.voyage.finishReason,
      scores: snapshot.voyage.scores,
    });
  }
}

function seat(socket, room, player) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  return ok({
    room: roomSnapshot(room),
    playerId: player.id,
    sessionToken: player.sessionToken,
    chat: room.chat.map((m) => ({ ...m })),
  });
}

function assignCaptain(room) {
  const next = [...room.players.values()]
    .sort((a, b) => Number(b.isConnected) - Number(a.isConnected) || a.joinedAt - b.joinedAt)[0];
  room.captainId = next.id;
  io.to(room.code).emit("room:captain-changed", { captainId: next.id });
}

function destroyRoom(room, reason) {
  clearTimeout(room.startTimer);
  clearVoyageTimers(room);
  for (const p of room.players.values()) clearTimeout(p.dropTimer);
  for (const s of socketsIn(room)) {
    s.leave(room.code);
    s.data.roomCode = undefined;
    s.data.playerId = undefined;
  }
  rooms.delete(room.code);
  log("info", `${room.code} scuttled (${reason})`);
}

function removePlayer(room, playerId, reason) {
  const player = room.players.get(playerId);
  if (!player) return;
  clearTimeout(player.dropTimer);
  room.players.delete(playerId);
  const s = io.sockets.sockets.get(player.socketId);
  if (s && s.data.playerId === playerId) {
    s.leave(room.code);
    s.data.roomCode = undefined;
    s.data.playerId = undefined;
  }
  log("info", `${room.code} ${player.name} ${reason}`);

  if (room.players.size === 0) {
    destroyRoom(room, "empty");
    return;
  }

  if (room.voyage) {
    for (const sailor of room.voyage.sailors.values()) {
      if (sailor.followingId === playerId) sailor.followingId = null;
    }
    if (room.voyage.status === "sailing") {
      record(room, "PLAYER_LEFT", playerId, { reason });
      checkWreck(room);
    }
  }

  io.to(room.code).emit("room:player-left", { playerId, name: player.name, reason });
  if (reason === "kicked" && s) s.emit("room:player-left", { playerId, name: player.name, reason });
  if (room.captainId === playerId) assignCaptain(room);

  if (room.phase === "starting" && room.players.size < MIN_PLAYERS) {
    clearTimeout(room.startTimer);
    room.phase = "lobby";
    io.to(room.code).emit("server:notice", { level: "warning", message: "Too few hands remain. The launch is called off." });
  }
  touch(room);
  broadcastState(room);
}

function current(socket) {
  const { roomCode, playerId } = socket.data ?? {};
  const room = roomCode && rooms.get(roomCode);
  const player = room?.players.get(playerId);
  return room && player ? { room, player } : null;
}

/** Context for voyage handlers: seated, sailing, and still standing. */
function sailing(socket) {
  const ctx = current(socket);
  if (!ctx) return { error: fail("NOT_IN_ROOM") };
  const { room, player } = ctx;
  if (!room.voyage) return { error: fail("NOT_SAILING") };
  if (room.voyage.status === "finished") return { error: fail("VOYAGE_OVER") };
  const sailor = room.voyage.sailors.get(player.id);
  if (!sailor) return { error: fail("NOT_IN_ROOM") };
  if (sailor.isEliminated) return { error: fail("ELIMINATED") };
  return { room, player, sailor, voyage: room.voyage };
}

/**
 * Wraps a handler so every request gets exactly one ack: rate limits are applied, thrown errors
 * become `INTERNAL`, and a client that forgot the ack callback cannot crash the server.
 */
function handle(socket, event, fn) {
  socket.on(event, (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (!takeToken(socket, event)) return reply(fail("RATE_LIMITED"));
    try {
      fn(payload && typeof payload === "object" ? payload : {}, reply);
    } catch (err) {
      log("error", `${event} crashed`, err);
      reply(fail("INTERNAL"));
    }
  });
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

io.on("connection", (socket) => {
  socket.data = {};
  const clientProtocol = Number(socket.handshake.auth?.protocol ?? 0);
  if (clientProtocol !== PROTOCOL_VERSION) {
    socket.emit("server:notice", {
      level: "warning",
      message: `This client speaks protocol ${clientProtocol || "?"}; the harbour speaks ${PROTOCOL_VERSION}. Refresh the page.`,
    });
  }
  log("debug", `socket ${socket.id} connected`);

  /* ---------------- Phase 1: crews & lobby ---------------- */

  handle(socket, "crew:create", (payload, ack) => {
    const playerName = cleanName(payload.playerName, PLAYER_NAME);
    const crewName = cleanName(payload.crewName, CREW_NAME);
    const outfit = cleanOutfit(payload.outfit);
    if (!playerName || !crewName || !AVATARS.has(payload.avatarId) || outfit === null) return ack(fail("INVALID_PAYLOAD"));

    const existing = current(socket);
    if (existing) removePlayer(existing.room, existing.player.id, "left");

    const player = createPlayer(socket, playerName, payload.avatarId, outfit);
    const room = createRoom(crewName, player);
    rooms.set(room.code, room);
    ack(seat(socket, room, player));
    log("info", `${room.code} ${playerName} founded ${crewName}`);
  });

  handle(socket, "crew:join", (payload, ack) => {
    const playerName = cleanName(payload.playerName, PLAYER_NAME);
    const code = typeof payload.roomCode === "string" ? payload.roomCode.trim().toUpperCase() : "";
    const outfit = cleanOutfit(payload.outfit);
    if (!playerName || !AVATARS.has(payload.avatarId) || code.length !== ROOM_CODE_LENGTH || outfit === null) {
      return ack(fail("INVALID_PAYLOAD"));
    }

    const room = rooms.get(code);
    if (!room) return ack(fail("ROOM_NOT_FOUND"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (room.players.size >= MAX_PLAYERS) return ack(fail("ROOM_FULL"));
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === playerName.toLowerCase());
    if (taken) return ack(fail("NAME_TAKEN"));

    const existing = current(socket);
    if (existing) removePlayer(existing.room, existing.player.id, "left");

    const player = createPlayer(socket, playerName, payload.avatarId, outfit);
    room.players.set(player.id, player);
    touch(room);
    ack(seat(socket, room, player));
    socket.to(room.code).emit("room:player-joined", { player: playerSnapshot(player, room) });
    broadcastState(room);
    log("info", `${room.code} ${playerName} came aboard (${room.players.size}/${MAX_PLAYERS})`);
  });

  handle(socket, "crew:rejoin", (payload, ack) => {
    const room = rooms.get(String(payload.roomCode ?? "").toUpperCase());
    const token = typeof payload.sessionToken === "string" ? payload.sessionToken : "";
    const player = room && token && [...room.players.values()].find((p) => p.sessionToken === token);
    if (!room || !player) return ack(fail("SESSION_EXPIRED"));

    clearTimeout(player.dropTimer);
    player.dropTimer = null;
    const previous = io.sockets.sockets.get(player.socketId);
    if (previous && previous.id !== socket.id) {
      previous.leave(room.code);
      previous.data.roomCode = undefined;
      previous.data.playerId = undefined;
      previous.emit("server:notice", { level: "warning", message: "Your berth was claimed from another tab." });
    }
    player.socketId = socket.id;
    player.isConnected = true;
    touch(room);
    ack(seat(socket, room, player));
    socket.to(room.code).emit("room:player-updated", { player: playerSnapshot(player, room) });
    broadcastState(room);
  });

  handle(socket, "crew:leave", (_payload, ack) => {
    const ctx = current(socket);
    if (ctx) removePlayer(ctx.room, ctx.player.id, "left");
    ack(ok(null));
  });

  handle(socket, "crew:kick", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;
    if (room.captainId !== player.id) return ack(fail("NOT_CAPTAIN"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    const targetId = typeof payload.playerId === "string" ? payload.playerId : "";
    if (!targetId || targetId === player.id || !room.players.has(targetId)) return ack(fail("INVALID_PAYLOAD"));
    ack(ok(null));
    removePlayer(room, targetId, "kicked");
  });

  handle(socket, "crew:configure", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;
    if (room.captainId !== player.id) return ack(fail("NOT_CAPTAIN"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (!payload.settings || typeof payload.settings !== "object") return ack(fail("INVALID_PAYLOAD"));

    const next = mergeSettings(room.settings, payload.settings);
    if (!next) return ack(fail("INVALID_PAYLOAD"));
    if (settingsEqual(next, room.settings)) return ack(ok({ ...next }));

    room.settings = next;
    for (const p of room.players.values()) if (p.id !== room.captainId) p.isReady = false;
    touch(room);
    ack(ok({ ...next }));
    io.to(room.code).emit("room:settings-changed", { settings: { ...next }, changedBy: player.id });
    systemChat(room, `The captain rewrote the articles: ${describeSettings(next)}.`);
    broadcastState(room);
    log("info", `${room.code} articles: ${describeSettings(next)}`);
  });

  handle(socket, "player:ready", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    if (ctx.room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (typeof payload.ready !== "boolean") return ack(fail("INVALID_PAYLOAD"));
    ctx.player.isReady = payload.ready;
    touch(ctx.room);
    const snapshot = playerSnapshot(ctx.player, ctx.room);
    ack(ok(snapshot));
    io.to(ctx.room.code).emit("room:player-updated", { player: snapshot });
    broadcastState(ctx.room);
  });

  handle(socket, "player:outfit", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    if (ctx.room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    const outfit = cleanOutfit(payload.outfit);
    if (!outfit) return ack(fail("INVALID_PAYLOAD"));
    ctx.player.outfit = outfit;
    touch(ctx.room);
    const snapshot = playerSnapshot(ctx.player, ctx.room);
    ack(ok(snapshot));
    socket.to(ctx.room.code).emit("room:player-updated", { player: snapshot });
    broadcastState(ctx.room);
  });

  handle(socket, "game:start", (_payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;
    if (room.captainId !== player.id) return ack(fail("NOT_CAPTAIN"));
    if (room.phase !== "lobby") return ack(fail("GAME_IN_PROGRESS"));
    if (room.players.size < MIN_PLAYERS) return ack(fail("NOT_ENOUGH_PLAYERS"));
    if ([...room.players.values()].some((p) => !p.isReady)) return ack(fail("PLAYERS_NOT_READY"));

    room.phase = "starting";
    touch(room);
    ack(ok(null));
    io.to(room.code).emit("game:starting", {
      startsAt: Date.now() + COUNTDOWN_SECONDS * 1000,
      seconds: COUNTDOWN_SECONDS,
    });
    broadcastState(room);
    log("info", `${room.code} countdown started`);

    room.startTimer = setTimeout(() => {
      if (!rooms.has(room.code) || room.phase !== "starting") return;
      room.phase = "in-game";
      startVoyage(room);
      for (const id of room.players.keys()) record(room, "PLAYER_JOINED", id, {});
      io.to(room.code).emit("game:started", {
        roomCode: room.code,
        startedAt: room.voyage.startedAt,
        endsAt: room.voyage.endsAt,
      });
      systemChat(room, `The ships leave harbour under these articles: ${describeSettings(room.settings)}.`);
      broadcastState(room);
      log("info", `${room.code} set sail with ${room.players.size} sailors`);
    }, COUNTDOWN_SECONDS * 1000 + 400);
  });

  /* ---------------- Phase 2: the voyage ---------------- */

  handle(socket, "map:move", (payload, ack) => {
    const ctx = sailing(socket);
    if (ctx.error) return ack(ctx.error);
    const { room, sailor } = ctx;

    const islandKey = typeof payload.islandKey === "string" ? payload.islandKey : "";
    const island = ISLAND_BY_KEY.get(islandKey);
    if (!island) return ack(fail("ISLAND_NOT_FOUND"));
    if (island.key === VAULT_ISLAND_KEY && !holdsAllRelics(sailor)) return ack(fail("ISLAND_HIDDEN"));
    if (sailor.currentIslandKey === island.key) return ack(ok({ islandKey, discovered: false }));

    const fromIslandKey = sailor.currentIslandKey;
    sailor.currentIslandKey = island.key;
    record(room, "MOVED", sailor.playerId, { islandKey, fromIslandKey });
    const discovered = discover(room, island.key, sailor.playerId);
    touch(room);

    ack(ok({ islandKey, discovered }));
    broadcastState(room);
  });

  handle(socket, "puzzle:submit", (payload, ack) => {
    const ctx = sailing(socket);
    if (ctx.error) return ack(ctx.error);
    const { room, sailor, voyage } = ctx;

    const puzzleKey = typeof payload.puzzleKey === "string" ? payload.puzzleKey : "";
    const raw = typeof payload.answer === "string" ? payload.answer.slice(0, ANSWER_MAX) : "";
    if (!puzzleKey || !normalizeAnswer(raw)) return ack(fail("INVALID_PAYLOAD"));

    const entry = PUZZLE_BY_KEY.get(puzzleKey);
    if (!entry) return ack(fail("PUZZLE_NOT_FOUND"));
    const { puzzle, island } = entry;
    if (sailor.currentIslandKey !== island.key) return ack(fail("NOT_ON_ISLAND"));
    if (hasSolved(voyage, sailor.playerId, puzzleKey)) return ack(fail("ALREADY_SOLVED"));
    if (island.kind === "TREASURE" && !holdsAllRelics(sailor)) return ack(fail("MISSING_RELICS"));

    const lastWrong = sailor.lastWrongAt.get(puzzleKey) ?? 0;
    if (Date.now() - lastWrong < WRONG_ANSWER_COOLDOWN_MS) {
      return ack(fail("RATE_LIMITED", "Catch your breath before guessing again."));
    }

    touch(room);
    const base = { puzzleKey, islandKey: island.key };

    if (!answerMatches(raw, puzzle.answerHash)) {
      sailor.lastWrongAt.set(puzzleKey, Date.now());

      if (!puzzle.trapOnFail || !room.settings.trapsEnabled) {
        record(room, "PUZZLE_FAILED", sailor.playerId, base);
        ack(ok({ outcome: "wrong", puzzleKey, strikes: sailor.strikes, eliminated: false, reward: null, treasureFound: false }));
        broadcastState(room);
        return;
      }

      sailor.strikes = Math.min(room.settings.maxStrikes, sailor.strikes + 1);
      sailor.isEliminated = sailor.strikes >= room.settings.maxStrikes;
      grant(sailor, CURSED_COIN);
      record(room, "TRAP_TRIGGERED", sailor.playerId, { ...base, strikes: sailor.strikes, eliminated: sailor.isEliminated });
      record(room, "ITEM_GRANTED", sailor.playerId, { itemKey: CURSED_COIN, quantity: 1 });
      checkWreck(room);

      ack(ok({
        outcome: "trap",
        puzzleKey,
        strikes: sailor.strikes,
        eliminated: sailor.isEliminated,
        reward: CURSED_COIN,
        treasureFound: false,
      }));
      broadcastState(room);
      return;
    }

    voyage.progress.push({ playerId: sailor.playerId, puzzleKey, solvedAt: new Date().toISOString() });
    record(room, "PUZZLE_SOLVED", sailor.playerId, base);
    if (puzzle.reward) {
      grant(sailor, puzzle.reward);
      record(room, "ITEM_GRANTED", sailor.playerId, { itemKey: puzzle.reward, quantity: 1 });
    }

    const treasureFound = island.kind === "TREASURE";
    if (treasureFound) {
      record(room, "TREASURE_FOUND", sailor.playerId, { puzzleKey });
      finishVoyage(room, sailor.playerId, "treasure");
      log("info", `${room.code} treasure claimed by ${ctx.player.name}`);
    } else {
      maybeAwakenVault(room, sailor);
    }

    ack(ok({ outcome: "solved", puzzleKey, strikes: sailor.strikes, eliminated: false, reward: puzzle.reward, treasureFound }));
    broadcastState(room);
  });

  handle(socket, "trade:offer", (payload, ack) => {
    const ctx = sailing(socket);
    if (ctx.error) return ack(ctx.error);
    const { room, sailor, voyage } = ctx;

    const itemKey = typeof payload.itemKey === "string" ? payload.itemKey : "";
    const toPlayerId = typeof payload.toPlayerId === "string" ? payload.toPlayerId : "";
    if (!itemKey || !toPlayerId) return ack(fail("INVALID_PAYLOAD"));
    if (!TRADABLE_ITEMS.has(itemKey)) return ack(fail("NOT_TRADABLE"));

    const quantity = sailor.inventory.get(itemKey) ?? 0;
    if (quantity <= 0) return ack(fail("ITEM_NOT_HELD"));

    const recipient = voyage.sailors.get(toPlayerId);
    if (!recipient || toPlayerId === sailor.playerId || !room.players.has(toPlayerId) || recipient.isEliminated) {
      return ack(fail("BAD_RECIPIENT"));
    }

    sailor.inventory.delete(itemKey);
    grant(recipient, itemKey, quantity);
    record(room, "TRADED", sailor.playerId, { itemKey, quantity, fromPlayerId: sailor.playerId, toPlayerId });
    touch(room);

    ack(ok({ itemKey, quantity, toPlayerId }));
    broadcastState(room);
  });

  /* ---------------- Phase 3: crew life ---------------- */

  handle(socket, "puzzle:hint", (payload, ack) => {
    const ctx = sailing(socket);
    if (ctx.error) return ack(ctx.error);
    const { room, sailor, voyage } = ctx;
    if (!room.settings.hintsEnabled) return ack(fail("HINTS_DISABLED"));

    const puzzleKey = typeof payload.puzzleKey === "string" ? payload.puzzleKey : "";
    const payWith = payload.payWith;
    if (!puzzleKey || !HINT_PAYMENTS.has(payWith)) return ack(fail("INVALID_PAYLOAD"));

    const entry = PUZZLE_BY_KEY.get(puzzleKey);
    if (!entry) return ack(fail("PUZZLE_NOT_FOUND"));
    const { puzzle, island } = entry;
    if (sailor.currentIslandKey !== island.key) return ack(fail("NOT_ON_ISLAND"));
    if (hasSolved(voyage, sailor.playerId, puzzleKey)) return ack(fail("ALREADY_SOLVED"));

    const owned = sailor.hints.filter((h) => h.puzzleKey === puzzleKey).length;
    if (owned >= puzzle.hints.length) return ack(fail("NO_HINTS_LEFT"));

    if (payWith === "strike") {
      if (sailor.strikes + 1 >= room.settings.maxStrikes) {
        return ack(fail("CANNOT_AFFORD", "Another strike would send you to the deep. Pay with a rumour instead."));
      }
      sailor.strikes += 1;
    } else {
      if ((sailor.inventory.get(TIDE_RUMOR) ?? 0) < 1) {
        return ack(fail("CANNOT_AFFORD", "You hold no Tide Rumor to pay with."));
      }
      take(sailor, TIDE_RUMOR);
    }

    const hint = { puzzleKey, level: owned + 1, text: puzzle.hints[owned], paidWith: payWith, boughtAt: Date.now() };
    sailor.hints.push(hint);
    sailor.hintsUsed += 1;
    record(room, "HINT_BOUGHT", sailor.playerId, { puzzleKey, islandKey: island.key, level: hint.level, paidWith: payWith });
    touch(room);

    ack(ok({ hint: { ...hint }, hintsLeft: puzzle.hints.length - hint.level, strikes: sailor.strikes }));
    broadcastState(room);
  });

  handle(socket, "spectate:follow", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;
    const voyage = room.voyage;
    if (!voyage) return ack(fail("NOT_SAILING"));
    const sailor = voyage.sailors.get(player.id);
    if (!sailor) return ack(fail("NOT_IN_ROOM"));
    if (!sailor.isEliminated && voyage.status !== "finished") return ack(fail("NOT_SPECTATOR"));

    let targetId;
    if (payload.playerId === null) targetId = null;
    else if (typeof payload.playerId === "string") targetId = payload.playerId;
    else return ack(fail("INVALID_PAYLOAD"));

    if (targetId !== null) {
      const target = voyage.sailors.get(targetId);
      if (!target || targetId === player.id || !room.players.has(targetId)) return ack(fail("BAD_RECIPIENT"));
    }
    if (sailor.followingId === targetId) return ack(ok({ followingId: targetId }));

    sailor.followingId = targetId;
    if (voyage.status === "sailing") record(room, "SPECTATING", player.id, { targetId });
    touch(room);
    ack(ok({ followingId: targetId }));
    broadcastState(room);
  });

  handle(socket, "chat:send", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const { room, player } = ctx;

    const hasCall = payload.callId !== undefined;
    const hasText = payload.text !== undefined;
    if (hasCall === hasText) return ack(fail("INVALID_PAYLOAD", "Send either words or a call, not both."));

    let message;
    if (hasCall) {
      if (typeof payload.callId !== "string" || !Object.hasOwn(QUICK_CALLS, payload.callId)) {
        return ack(fail("INVALID_PAYLOAD"));
      }
      message = postChat(room, player.id, "call", QUICK_CALLS[payload.callId], { callId: payload.callId });
    } else {
      const { text, filtered } = cleanChat(payload.text);
      if (!text) return ack(fail("INVALID_PAYLOAD", "Say something first."));
      const now = Date.now();
      if (player.lastChat && player.lastChat.text === text && now - player.lastChat.at < CHAT_REPEAT_WINDOW_MS) {
        return ack(fail("RATE_LIMITED", "The crew heard you the first time."));
      }
      player.lastChat = { text, at: now };
      message = postChat(room, player.id, "text", text, { filtered });
    }
    touch(room);
    ack(ok({ ...message }));
  });

  handle(socket, "voyage:sync", (payload, ack) => {
    const ctx = current(socket);
    if (!ctx) return ack(fail("NOT_IN_ROOM"));
    const voyage = ctx.room.voyage;
    if (!voyage) return ack(fail("NOT_SAILING"));
    const since = payload.sinceSeq;
    if (!Number.isInteger(since) || since < 0) return ack(fail("INVALID_PAYLOAD"));

    const events = voyage.log.filter((e) => e.seq > since).map((e) => ({ ...e, payload: { ...e.payload } }));
    const oldest = voyage.log[0]?.seq ?? voyage.lastSeq + 1;
    const complete = since >= voyage.lastSeq || oldest <= since + 1;
    ack(ok({ events, lastSeq: voyage.lastSeq, complete }));
  });

  /* ---------------- Connection lifecycle ---------------- */

  socket.on("disconnect", (reason) => {
    log("debug", `socket ${socket.id} disconnected (${reason})`);
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

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const anyoneHere = [...room.players.values()].some((p) => p.isConnected);
    if (room.phase === "finished" && now - (room.voyage?.finishedAt ?? now) > FINISHED_ROOM_MS) {
      destroyRoom(room, "voyage long over");
    } else if (!anyoneHere && now - room.lastActivityAt > IDLE_ROOM_MS) {
      destroyRoom(room, "abandoned");
    }
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref();

function shutdown(signal) {
  log("info", `${signal} received — lowering the sails`);
  io.emit("server:notice", { level: "danger", message: "The harbour is closing. Your voyage will end shortly." });
  clearInterval(sweeper);
  for (const room of [...rooms.values()]) destroyRoom(room, "shutdown");
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

http.listen(PORT, () => {
  log("info", `Pirate Protocol mock server (protocol ${PROTOCOL_VERSION}) on http://localhost:${PORT}`);
  log("info", `${ISLANDS.length} islands, ${PUZZLE_BY_KEY.size} riddles loaded. Health: http://localhost:${PORT}/health`);
});
