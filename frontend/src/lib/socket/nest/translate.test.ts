import { describe, expect, it } from "vitest";
import { AVATAR_IDS, START_ISLAND_KEY, type ErrorCode } from "../contract";
import {
  NEST_SETTINGS,
  NEST_USERNAME_MAX,
  NestMirror,
  avatarFor,
  displayName,
  errorCodeFor,
  staleCrewCode,
  toNestUsername,
  userIdFromToken,
} from "./translate";
import {
  ALL_RELICS,
  ANNE,
  CODE,
  CREATED_AT,
  JACK,
  MARY,
  event,
  item,
  player,
  state,
  tokenFor,
} from "@/test/nest-fixtures";

/* ------------------------------------------------------------------ */
/* Names & likenesses                                                  */
/* ------------------------------------------------------------------ */

describe("toNestUsername", () => {
  it.each([
    ["Calico Jack", "calico_jack"],
    ["  Anne   Bonny  ", "anne_bonny"],
    ["MARY READ", "mary_read"],
    ["Émile Dubois", "emile_dubois"],
    ["Jack-o'-Lantern", "jackolantern"],
    ["captain_42", "captain_42"],
  ])("signs %j in as %j", (input, expected) => {
    expect(toNestUsername(input)).toBe(expected);
  });

  it("never exceeds the server's 16-character limit", () => {
    const username = toNestUsername("Bartholomew Roberts the Third");
    expect(username).toHaveLength(NEST_USERNAME_MAX);
    expect(username).toBe("bartholomew_robe");
  });

  it("only ever produces characters the server accepts", () => {
    for (const name of ["Ångström Ölsen", "Señor Pez!", "Zoë 🦜 Quill", "O'Malley"]) {
      expect(toNestUsername(name)).toMatch(/^[a-z0-9_]*$/);
    }
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(toNestUsername("!!! ???")).toBe("");
  });

  it("does not leave doubled or dangling underscores where symbols were", () => {
    expect(toNestUsername("Zoë 🦜 Quill")).toBe("zoe_quill");
    expect(toNestUsername("_Mary__Read_")).toBe("mary_read");
  });
});

describe("displayName", () => {
  it("turns a server username back into a pirate name", () => {
    expect(displayName("calico_jack")).toBe("Calico Jack");
    expect(displayName("anne")).toBe("Anne");
  });

  it("ignores stray underscores", () => {
    expect(displayName("_mary__read_")).toBe("Mary Read");
  });

  it("keeps digits as they are", () => {
    expect(displayName("captain_42")).toBe("Captain 42");
  });
});

describe("avatarFor", () => {
  it("always gives the same sailor the same likeness", () => {
    expect(avatarFor(ANNE.userId)).toBe(avatarFor(ANNE.userId));
  });

  it("only hands out likenesses that exist", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(AVATAR_IDS).toContain(avatarFor(`user-${i}`));
    }
  });

  it("spreads sailors across more than one likeness", () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => avatarFor(`user-${i}`)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("userIdFromToken", () => {
  it("reads the user id from the token body", () => {
    expect(userIdFromToken(tokenFor(ANNE.userId))).toBe(ANNE.userId);
  });

  it("ignores the signature entirely", () => {
    expect(userIdFromToken(tokenFor(JACK.userId, "forged"))).toBe(JACK.userId);
  });

  it.each([
    ["an empty string", ""],
    ["a body that is not base64", "%%%.sig"],
    ["a body that is not JSON", `${btoa("not json")}.sig`],
    ["a body without a user id", `${btoa(JSON.stringify({ exp: 1 }))}.sig`],
    ["a body with an empty user id", `${btoa(JSON.stringify({ userId: "" }))}.sig`],
    ["a body with a numeric user id", `${btoa(JSON.stringify({ userId: 42 }))}.sig`],
  ])("returns null for %s", (_label, token) => {
    expect(userIdFromToken(token)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

describe("errorCodeFor", () => {
  const cases: [string, ErrorCode][] = [
    ["Room not found", "ROOM_NOT_FOUND"],
    ["Invalid room code", "ROOM_NOT_FOUND"],
    ["code must be a 6 character room code", "ROOM_NOT_FOUND"],
    ["Crew is full", "ROOM_FULL"],
    ["This hunt is over", "VOYAGE_OVER"],
    ["The treasure has already been claimed", "VOYAGE_OVER"],
    ["Leave crew XYZ789 first", "IN_ANOTHER_CREW"],
    ["You are not in this crew", "NOT_IN_ROOM"],
    ["Join the crew first", "NOT_IN_ROOM"],
    ["Island not found", "ISLAND_NOT_FOUND"],
    ["Puzzle not found", "PUZZLE_NOT_FOUND"],
    ["Puzzle already solved", "ALREADY_SOLVED"],
    ["Missing relics: compass, spyglass", "MISSING_RELICS"],
    ["That item cannot be traded", "NOT_TRADABLE"],
    ["Unknown item", "NOT_TRADABLE"],
    ["Choose another sailor", "BAD_RECIPIENT"],
    ["That sailor is not in your crew", "BAD_RECIPIENT"],
    ["You do not hold that item", "ITEM_NOT_HELD"],
    ["You are out of the hunt", "ELIMINATED"],
    ["Invalid token", "SESSION_EXPIRED"],
    ["Unauthorized", "SESSION_EXPIRED"],
    ["Missing bearer token", "SESSION_EXPIRED"],
    ["Too many requests", "RATE_LIMITED"],
    ["username must match /^[a-z0-9_]{3,16}$/", "INVALID_PAYLOAD"],
    ["answer should not be empty", "INVALID_PAYLOAD"],
  ];

  it.each(cases)("maps %j to %s", (message, code) => {
    expect(errorCodeFor(message)).toBe(code);
  });

  it("falls back to INTERNAL for messages it does not recognise", () => {
    expect(errorCodeFor("The kraken ate the database")).toBe("INTERNAL");
  });

  it("treats a missing message as INTERNAL", () => {
    expect(errorCodeFor(undefined)).toBe("INTERNAL");
    expect(errorCodeFor("")).toBe("INTERNAL");
  });

  it("is not fooled by a message that only mentions a crew in passing", () => {
    expect(errorCodeFor("Please leave crew notes in the log")).not.toBe("IN_ANOTHER_CREW");
  });
});

describe("staleCrewCode", () => {
  it("pulls the crew code out of the server's message", () => {
    expect(staleCrewCode("Leave crew ABC234 first")).toBe("ABC234");
  });

  it("normalises the code to upper case", () => {
    expect(staleCrewCode("leave crew abc234 first")).toBe("ABC234");
  });

  it("returns null for any other message", () => {
    expect(staleCrewCode("Crew is full")).toBeNull();
    expect(staleCrewCode(undefined)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* NestMirror                                                          */
/* ------------------------------------------------------------------ */

function mirrorFor(who: { userId: string } = ANNE) {
  return new NestMirror(CODE, who.userId);
}

describe("NestMirror — seating", () => {
  it("finds this sailor's player id once the first state arrives", () => {
    const mirror = mirrorFor();
    expect(mirror.playerId).toBeNull();
    mirror.ingest(state());
    expect(mirror.playerId).toBe(ANNE.id);
    expect(mirror.me()?.username).toBe(ANNE.username);
  });

  it("returns null when this sailor is not in the crew", () => {
    const mirror = mirrorFor(MARY);
    mirror.ingest(state());
    expect(mirror.playerId).toBeNull();
    expect(mirror.me()).toBeNull();
  });

  it("refuses to build a push before it has any state", () => {
    expect(() => mirrorFor().toPush()).toThrow();
  });
});

describe("NestMirror — lobby push", () => {
  it("describes a moored crew in the frontend's terms", () => {
    const mirror = mirrorFor();
    const { push } = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));

    expect(push).toMatchObject({
      code: CODE,
      crewName: "The Black Gull",
      phase: "lobby",
      captainId: ANNE.id,
      maxPlayers: 6,
      minPlayers: 1,
      voyage: null,
      you: [],
      yourHints: [],
      settings: NEST_SETTINGS,
    });
    expect(push.createdAt).toBe(Date.parse(CREATED_AT));
    expect(push.players.map((p) => p.name)).toEqual(["Anne Bonny", "Calico Jack"]);
  });

  it("marks every sailor ready, since the server has no ready flags", () => {
    const { push } = mirrorFor().ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(push.players.every((p) => p.isReady)).toBe(true);
  });

  it("reports connection from the server's online flag", () => {
    const { push } = mirrorFor().ingest(
      state({ players: [player(ANNE, { isHost: true }), player(JACK, { isOnline: false })] }),
    );
    expect(push.players.find((p) => p.id === JACK.id)?.isConnected).toBe(false);
  });

  it("gives each sailor a stable likeness", () => {
    const { push } = mirrorFor().ingest(state());
    expect(push.players[0].avatarId).toBe(avatarFor(ANNE.userId));
  });

  it("plays the server's fixed ruleset", () => {
    expect(NEST_SETTINGS).toMatchObject({ maxStrikes: 3, trapsEnabled: true, hintsEnabled: false, timeLimitMinutes: 0 });
  });
});

describe("NestMirror — captaincy", () => {
  it("hands the hat to the server's host", () => {
    const { push } = mirrorFor().ingest(state({ players: [player(JACK), player(ANNE, { isHost: true })] }));
    expect(push.captainId).toBe(ANNE.id);
    expect(push.players.find((p) => p.id === ANNE.id)?.isCaptain).toBe(true);
  });

  it("lets the longest-serving sailor take the helm when the host has gone", () => {
    const mirror = mirrorFor(JACK);
    mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK), player(MARY)] }));
    const change = mirror.ingest(state({ players: [player(JACK), player(MARY)] }));

    expect(change.push.captainId).toBe(JACK.id);
    expect(change.captainId).toBe(JACK.id);
  });

  it("does not announce a captain change on the first state", () => {
    expect(mirrorFor().ingest(state()).captainId).toBeNull();
  });

  it("does not announce a captain change when the hat stays put", () => {
    const mirror = mirrorFor();
    mirror.ingest(state());
    const change = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(change.captainId).toBeNull();
  });
});

describe("NestMirror — arrivals and departures", () => {
  it("does not announce anyone on the first state", () => {
    const change = mirrorFor().ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(change.joined).toEqual([]);
    expect(change.left).toEqual([]);
  });

  it("announces sailors who came aboard", () => {
    const mirror = mirrorFor();
    mirror.ingest(state());
    const change = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(change.joined.map((p) => p.id)).toEqual([JACK.id]);
    expect(change.joined[0].name).toBe("Calico Jack");
  });

  it("announces sailors who went ashore, by their display name", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const change = mirror.ingest(state());
    expect(change.left).toEqual([{ playerId: JACK.id, name: "Calico Jack" }]);
  });

  it("announces sailors whose connection changed", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const change = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK, { isOnline: false })] }));
    expect(change.updated.map((p) => [p.id, p.isConnected])).toEqual([[JACK.id, false]]);
  });

  it("keeps a sailor's joining time across states", () => {
    const mirror = mirrorFor();
    const joined = event("PLAYER_JOINED", JACK.id);
    const first = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)], log: [joined] }));
    const second = mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)], log: [joined] }));
    const joinedAt = (push: typeof first.push) => push.players.find((p) => p.id === JACK.id)?.joinedAt;
    expect(joinedAt(first.push)).toBe(Date.parse(joined.createdAt));
    expect(joinedAt(second.push)).toBe(joinedAt(first.push));
  });
});

describe("NestMirror — presence", () => {
  it("returns the updated sailor when they drop offline", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const updated = mirror.presence({ playerId: JACK.id, online: false });
    expect(updated).toMatchObject({ id: JACK.id, isConnected: false });
    expect(mirror.toPush().players.find((p) => p.id === JACK.id)?.isConnected).toBe(false);
  });

  it("returns null when nothing changed", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ players: [player(ANNE, { isHost: true }), player(JACK)] }));
    expect(mirror.presence({ playerId: JACK.id, online: true })).toBeNull();
  });

  it("returns null for a sailor it has never seen", () => {
    const mirror = mirrorFor();
    mirror.ingest(state());
    expect(mirror.presence({ playerId: "player-ghost", online: false })).toBeNull();
  });

  it("returns null before any state has arrived", () => {
    expect(mirrorFor().presence({ playerId: JACK.id, online: false })).toBeNull();
  });
});

describe("NestMirror — setting sail and finishing", () => {
  it("reports the voyage starting when the server leaves the lobby", () => {
    const mirror = mirrorFor();
    mirror.ingest(state());
    const moved = event("MOVED", ANNE.id, { islandKey: "port-royal" });
    const change = mirror.ingest(state({ status: "ACTIVE", log: [moved] }));

    expect(change.started).toBe(true);
    expect(change.push.phase).toBe("in-game");
    expect(change.push.voyage?.startedAt).toBe(Date.parse(moved.createdAt));
  });

  it("dates the start from the first real move, not from arrivals", () => {
    const mirror = mirrorFor();
    mirror.ingest(state());
    const joined = event("PLAYER_JOINED", JACK.id);
    const moved = event("MOVED", ANNE.id, { islandKey: "blackreef" });
    const change = mirror.ingest(state({ status: "ACTIVE", log: [joined, moved] }));
    expect(change.push.voyage?.startedAt).toBe(Date.parse(moved.createdAt));
  });

  it("does not report a start for a crew that was already sailing on refresh", () => {
    const change = mirrorFor().ingest(state({ status: "ACTIVE" }));
    expect(change.started).toBe(false);
    expect(change.push.phase).toBe("in-game");
  });

  it("reports the voyage finishing with the server's winner", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE" }));
    const found = event("TREASURE_FOUND", ANNE.id, { puzzleKey: "vault-protocol" });
    const change = mirror.ingest(state({ status: "FINISHED", winnerPlayerId: ANNE.id, log: [found] }));

    expect(change.finished).toBe(true);
    expect(change.push.phase).toBe("finished");
    expect(change.push.voyage).toMatchObject({
      status: "finished",
      finishReason: "treasure",
      winnerPlayerId: ANNE.id,
      finishedAt: Date.parse(found.createdAt),
    });
  });

  it("does not report a finish twice", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE" }));
    mirror.ingest(state({ status: "FINISHED", winnerPlayerId: ANNE.id }));
    expect(mirror.ingest(state({ status: "FINISHED", winnerPlayerId: ANNE.id })).finished).toBe(false);
  });
});

describe("NestMirror — the voyage snapshot", () => {
  it("leaves out everything the server does not track", () => {
    const { push } = mirrorFor().ingest(state({ status: "ACTIVE" }));
    expect(push.voyage).toMatchObject({ endsAt: null, scores: [], finishReason: null, finishedAt: null });
    expect(push.voyage?.sailors.every((s) => s.hintsUsed === 0 && s.followingId === null)).toBe(true);
    expect(push.voyage?.islands.every((i) => i.puzzles.every((p) => p.hintCount === 0))).toBe(true);
  });

  it("copies each sailor's position, strikes and fate", () => {
    const { push } = mirrorFor().ingest(
      state({
        status: "ACTIVE",
        players: [
          player(ANNE, { isHost: true, currentIslandKey: "blackreef" }),
          player(JACK, { strikes: 3, isEliminated: true, currentIslandKey: "kraken-shoal" }),
        ],
      }),
    );
    expect(push.voyage?.sailors).toEqual([
      { playerId: ANNE.id, currentIslandKey: "blackreef", strikes: 0, isEliminated: false, hintsUsed: 0, followingId: null },
      { playerId: JACK.id, currentIslandKey: "kraken-shoal", strikes: 3, isEliminated: true, hintsUsed: 0, followingId: null },
    ]);
  });

  it("dates each solve from the server's PUZZLE_SOLVED event", () => {
    const solved = event("PUZZLE_SOLVED", ANNE.id, { puzzleKey: "port-royal-map" });
    const { push } = mirrorFor().ingest(
      state({ status: "ACTIVE", progress: [{ playerId: ANNE.id, puzzleKey: "port-royal-map" }], log: [solved] }),
    );
    expect(push.voyage?.progress).toEqual([{ playerId: ANNE.id, puzzleKey: "port-royal-map", solvedAt: solved.createdAt }]);
  });

  it("passes this sailor's own hold straight through", () => {
    const you = [item("compass"), item("tide-rumor", 2)];
    expect(mirrorFor().ingest(state({ status: "ACTIVE", you })).push.you).toEqual(you);
  });
});

describe("NestMirror — the fog", () => {
  it("starts with only the home port revealed", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ players: [player(ANNE, { isHost: true, currentIslandKey: null })] }));
    expect(mirror.isDiscovered(START_ISLAND_KEY)).toBe(true);
    expect(mirror.isDiscovered("blackreef")).toBe(false);
  });

  it("lifts the fog where sailors stand, sailed and solved", () => {
    const mirror = mirrorFor();
    mirror.ingest(
      state({
        status: "ACTIVE",
        players: [player(ANNE, { isHost: true, currentIslandKey: "blackreef" })],
        progress: [{ playerId: ANNE.id, puzzleKey: "serpent-anagram" }],
        log: [event("MOVED", ANNE.id, { islandKey: "widows-rock" })],
      }),
    );
    for (const key of ["port-royal", "blackreef", "serpent-cay", "widows-rock"]) {
      expect(mirror.isDiscovered(key)).toBe(true);
    }
    expect(mirror.isDiscovered("goldmouth")).toBe(false);
  });

  it("remembers islands even after the moves fall out of the server's log", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE", log: [event("MOVED", ANNE.id, { islandKey: "goldmouth" })] }));
    mirror.ingest(state({ status: "ACTIVE", log: [] }));
    expect(mirror.isDiscovered("goldmouth")).toBe(true);
    expect(mirror.toPush().voyage?.discovered).toContain("goldmouth");
  });
});

describe("NestMirror — the ship's log", () => {
  it("numbers events in the order they first appear", () => {
    const mirror = mirrorFor();
    const a = event("MOVED", ANNE.id, { islandKey: "blackreef" });
    const b = event("PUZZLE_FAILED", ANNE.id, { puzzleKey: "blackreef-cipher" });
    mirror.ingest(state({ status: "ACTIVE", log: [a, b] }));
    expect(mirror.toPush().voyage?.log.map((e) => [e.id, e.seq])).toEqual([
      [a.id, 1],
      [b.id, 2],
    ]);
    expect(mirror.toPush().voyage?.lastSeq).toBe(2);
  });

  it("keeps an event's number when it is seen again", () => {
    const mirror = mirrorFor();
    const a = event("MOVED", ANNE.id, { islandKey: "blackreef" });
    mirror.ingest(state({ status: "ACTIVE", log: [a] }));
    expect(mirror.event(a).seq).toBe(1);
    mirror.ingest(state({ status: "ACTIVE", log: [a] }));
    expect(mirror.event(a).seq).toBe(1);
  });

  it("numbers a pushed event that arrives before its state", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE" }));
    const pushed = event("ITEM_GRANTED", ANNE.id, { itemKey: "compass" });
    expect(mirror.event(pushed).seq).toBe(1);
    mirror.ingest(state({ status: "ACTIVE", log: [pushed] }));
    expect(mirror.toPush().voyage?.log[0].seq).toBe(1);
  });

  it("replays only what a client missed", () => {
    const mirror = mirrorFor();
    const events = [
      event("MOVED", ANNE.id, { islandKey: "blackreef" }),
      event("PUZZLE_SOLVED", ANNE.id, { puzzleKey: "blackreef-cipher" }),
      event("ITEM_GRANTED", ANNE.id, { itemKey: "spyglass" }),
    ];
    mirror.ingest(state({ status: "ACTIVE", log: events }));
    const replay = mirror.eventsSince(1);
    expect(replay.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(replay.lastSeq).toBe(3);
  });

  it("names where the sailor sailed from", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE", players: [player(ANNE, { isHost: true, currentIslandKey: "port-royal" })] }));
    const moved = event("MOVED", ANNE.id, { islandKey: "blackreef" });
    mirror.ingest(
      state({
        status: "ACTIVE",
        players: [player(ANNE, { isHost: true, currentIslandKey: "blackreef" })],
        log: [moved],
      }),
    );
    expect(mirror.event(moved).payload).toMatchObject({ islandKey: "blackreef", fromIslandKey: "port-royal" });
  });

  it("names the island of a failed answer and a sprung trap", () => {
    const mirror = mirrorFor();
    const failed = event("PUZZLE_FAILED", ANNE.id, { puzzleKey: "blackreef-cipher" });
    const trap = event("TRAP_TRIGGERED", ANNE.id, { puzzleKey: "kraken-arms", strikes: 1, eliminated: false });
    mirror.ingest(state({ status: "ACTIVE", log: [failed, trap] }));
    expect(mirror.event(failed).payload.islandKey).toBe("blackreef");
    expect(mirror.event(trap).payload.islandKey).toBe("kraken-shoal");
  });

  it("keeps an island the server already named", () => {
    const mirror = mirrorFor();
    const failed = event("PUZZLE_FAILED", ANNE.id, { puzzleKey: "blackreef-cipher", islandKey: "goldmouth" });
    mirror.ingest(state({ status: "ACTIVE", log: [failed] }));
    expect(mirror.event(failed).payload.islandKey).toBe("goldmouth");
  });

  it("counts a granted item as one", () => {
    const mirror = mirrorFor();
    const granted = event("ITEM_GRANTED", ANNE.id, { itemKey: "compass" });
    mirror.ingest(state({ status: "ACTIVE", log: [granted] }));
    expect(mirror.event(granted).payload.quantity).toBe(1);
  });

  it("reads the size of a stack handed to this sailor from their hold", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE", players: [player(ANNE, { isHost: true }), player(JACK)] }));
    const traded = event("TRADED", JACK.id, { itemKey: "tide-rumor", fromPlayerId: JACK.id, toPlayerId: ANNE.id });
    mirror.ingest(
      state({
        status: "ACTIVE",
        players: [player(ANNE, { isHost: true }), player(JACK)],
        you: [item("tide-rumor", 3)],
        log: [traded],
      }),
    );
    expect(mirror.event(traded).payload.quantity).toBe(3);
  });

  it("reads the size of a stack this sailor gave away from their hold", () => {
    const mirror = mirrorFor();
    const crew = [player(ANNE, { isHost: true }), player(JACK)];
    mirror.ingest(state({ status: "ACTIVE", players: crew, you: [item("cursed-coin", 2)] }));
    const traded = event("TRADED", ANNE.id, { itemKey: "cursed-coin", fromPlayerId: ANNE.id, toPlayerId: JACK.id });
    mirror.ingest(state({ status: "ACTIVE", players: crew, you: [], log: [traded] }));
    expect(mirror.event(traded).payload.quantity).toBe(2);
  });

  it("assumes a single item for trades between other sailors", () => {
    const mirror = mirrorFor();
    const crew = [player(ANNE, { isHost: true }), player(JACK), player(MARY)];
    mirror.ingest(state({ status: "ACTIVE", players: crew }));
    const traded = event("TRADED", JACK.id, { itemKey: "tide-rumor", fromPlayerId: JACK.id, toPlayerId: MARY.id });
    mirror.ingest(state({ status: "ACTIVE", players: crew, log: [traded] }));
    expect(mirror.event(traded).payload.quantity).toBe(1);
  });
});

describe("NestMirror — the Vault awakening", () => {
  it("announces the Vault the moment the fifth relic lands", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE", you: ALL_RELICS.slice(0, 4) }));
    expect(mirror.ingest(state({ status: "ACTIVE", you: ALL_RELICS })).vaultAwakened).toBe(true);
  });

  it("announces it only once", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE" }));
    mirror.ingest(state({ status: "ACTIVE", you: ALL_RELICS }));
    expect(mirror.ingest(state({ status: "ACTIVE", you: ALL_RELICS })).vaultAwakened).toBe(false);
  });

  it("stays quiet when a sailor returns already holding every relic", () => {
    expect(mirrorFor().ingest(state({ status: "ACTIVE", you: ALL_RELICS })).vaultAwakened).toBe(false);
  });

  it("builds a derived event with a unique id and the next number", () => {
    const mirror = mirrorFor();
    mirror.ingest(state({ status: "ACTIVE", log: [event("MOVED", ANNE.id, { islandKey: "goldmouth" })] }));
    const vault = mirror.vaultEvent();
    expect(vault).toMatchObject({ type: "VAULT_AWAKENED", playerId: ANNE.id, seq: 2, payload: {} });
    expect(vault.id).toMatch(/^derived:vault:/);
  });
});

describe("NestMirror — reading the server's verdict", () => {
  const crew = [player(ANNE, { isHost: true, currentIslandKey: "blackreef" })];

  it("calls it solved when the server recorded new progress", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: crew });
    mirror.ingest(before);
    const after = state({
      status: "ACTIVE",
      players: crew,
      progress: [{ playerId: ANNE.id, puzzleKey: "blackreef-cipher" }],
      you: [item("spyglass")],
    });
    expect(mirror.verdict(before, after, "blackreef-cipher")).toEqual({
      outcome: "solved",
      puzzleKey: "blackreef-cipher",
      strikes: 0,
      eliminated: false,
      reward: "spyglass",
      treasureFound: false,
    });
  });

  it("calls it a trap when the server added a strike", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: crew });
    mirror.ingest(before);
    const after = state({
      status: "ACTIVE",
      players: [player(ANNE, { isHost: true, currentIslandKey: "kraken-shoal", strikes: 1 })],
      you: [item("cursed-coin")],
    });
    expect(mirror.verdict(before, after, "kraken-arms")).toMatchObject({
      outcome: "trap",
      strikes: 1,
      eliminated: false,
      reward: "cursed-coin",
    });
  });

  it("reports elimination exactly as the server recorded it", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: [player(ANNE, { isHost: true, strikes: 2 })] });
    mirror.ingest(before);
    const after = state({ status: "ACTIVE", players: [player(ANNE, { isHost: true, strikes: 3, isEliminated: true })] });
    expect(mirror.verdict(before, after, "deadman-plaque")).toMatchObject({ outcome: "trap", strikes: 3, eliminated: true });
  });

  it("calls it wrong when nothing changed", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: crew });
    mirror.ingest(before);
    expect(mirror.verdict(before, before, "blackreef-cipher")).toMatchObject({ outcome: "wrong", reward: null });
  });

  it("does not count someone else's solve as this sailor's", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: [...crew, player(JACK)] });
    mirror.ingest(before);
    const after = { ...before, progress: [{ playerId: JACK.id, puzzleKey: "blackreef-cipher" }] };
    expect(mirror.verdict(before, after, "blackreef-cipher").outcome).toBe("wrong");
  });

  it("does not count an old solve as a new one", () => {
    const mirror = mirrorFor();
    const progress = [{ playerId: ANNE.id, puzzleKey: "blackreef-cipher" }];
    const before = state({ status: "ACTIVE", players: crew, progress });
    mirror.ingest(before);
    expect(mirror.verdict(before, before, "blackreef-cipher").outcome).toBe("wrong");
  });

  it("reports the treasure only when the server names this sailor the winner", () => {
    const mirror = mirrorFor();
    const before = state({ status: "ACTIVE", players: crew, you: ALL_RELICS });
    mirror.ingest(before);
    const after = state({
      status: "FINISHED",
      players: crew,
      progress: [{ playerId: ANNE.id, puzzleKey: "vault-protocol" }],
      winnerPlayerId: ANNE.id,
      you: [...ALL_RELICS, item("treasure-chest")],
    });
    expect(mirror.verdict(before, after, "vault-protocol")).toMatchObject({
      outcome: "solved",
      reward: "treasure-chest",
      treasureFound: true,
    });
  });
});
