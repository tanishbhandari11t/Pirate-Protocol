import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_LIMIT, DEFAULT_SETTINGS, type HintEntry, type ScoreEntry } from "../socket/contract";
import {
  crewReducer,
  describeSettings,
  describeSettingsChange,
  describeVoyageEvent,
  formatClock,
  heldRelicCount,
  hintsFor,
  initialCrewState,
  readyCount,
  selectCaptain,
  selectMe,
  selectScore,
  selectSettings,
  startBlockers,
  toVoyageRoom,
  watchersOf,
  type CrewAction,
  type CrewState,
} from "./reducer";
import { ANNE, JACK, MARY, T0, chat, gameEvent, grant, push, room, sailor, voyage } from "@/test/crew-fixtures";

function run(...actions: CrewAction[]): CrewState {
  return actions.reduce(crewReducer, initialCrewState);
}

function seatedIn(snapshot = room(), playerId = ANNE.id): CrewState {
  return run({ type: "seated", grant: grant(snapshot, playerId), at: T0 });
}

const lastLine = (state: CrewState) => state.log.at(-1);

/* ------------------------------------------------------------------ */
/* Seating                                                             */
/* ------------------------------------------------------------------ */

describe("taking a seat", () => {
  it("records the room and this sailor's id", () => {
    const state = seatedIn();
    expect(state.room?.code).toBe("ABC234");
    expect(state.playerId).toBe(ANNE.id);
  });

  it("logs the arrival with the ship's bare name", () => {
    expect(lastLine(seatedIn())).toMatchObject({ tone: "join", text: "Anne Bonny came aboard the Black Gull." });
  });

  it("does not log a second arrival when reseated on the same ship", () => {
    const first = seatedIn();
    const again = crewReducer(first, { type: "seated", grant: grant(room()), at: T0 + 1000 });
    expect(again.log).toHaveLength(1);
  });

  it("keeps the private hold across a reseat on the same ship", () => {
    const sailing = crewReducer(seatedIn(), {
      type: "room-state",
      room: push(room(), { you: [{ itemKey: "compass", name: "Brass Compass", description: "", quantity: 1 }] }),
    });
    const again = crewReducer(sailing, { type: "seated", grant: grant(room()), at: T0 });
    expect(again.you).toHaveLength(1);
  });

  it("forgets the old ship entirely when seated on a new one", () => {
    const first = seatedIn();
    const next = crewReducer(first, { type: "seated", grant: grant(room({ code: "XYZ789" })), at: T0 });
    expect(next.log.map((l) => l.text)).toEqual(["Anne Bonny came aboard the Black Gull."]);
    expect(next.room?.code).toBe("XYZ789");
  });

  it("knows a voyage is under way when seated mid-voyage", () => {
    const state = seatedIn(room({ phase: "in-game", voyage: voyage() }));
    expect(state.voyageStarted).toBe(true);
    expect(state.voyageFinished).toBe(false);
  });

  it("restores the outcome when seated after the voyage ended", () => {
    const finished = voyage({ status: "finished", finishReason: "treasure", winnerPlayerId: JACK.id, finishedAt: T0 + 5000 });
    const state = seatedIn(room({ phase: "finished", voyage: finished }));
    expect(state.voyageFinished).toBe(true);
    expect(state.outcome).toEqual({ winnerPlayerId: JACK.id, reason: "treasure", scores: [], at: T0 + 5000 });
  });

  it("rebuilds the ship's log from the voyage, oldest first", () => {
    const log = [
      gameEvent(2, "PUZZLE_SOLVED", ANNE.id, { islandKey: "blackreef" }),
      gameEvent(1, "MOVED", ANNE.id, { islandKey: "blackreef" }),
    ];
    const state = seatedIn(room({ phase: "in-game", players: [ANNE, JACK], voyage: voyage({ log }) }));
    expect(state.log.slice(1).map((l) => l.text)).toEqual([
      "You dropped anchor at Blackreef.",
      "You cracked the riddle of Blackreef.",
    ]);
    expect(state.lastSeq).toBe(2);
  });

  it("merges the chat history it was handed", () => {
    const state = run({ type: "seated", grant: grant(room(), ANNE.id, [chat("b", 2, JACK.id), chat("a", 1, ANNE.id)]), at: T0 });
    expect(state.chat.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

/* ------------------------------------------------------------------ */
/* Room state                                                          */
/* ------------------------------------------------------------------ */

describe("room state pushes", () => {
  it("are ignored before a seat is taken", () => {
    expect(run({ type: "room-state", room: push(room()) })).toBe(initialCrewState);
  });

  it("are ignored for another ship", () => {
    const state = seatedIn();
    expect(crewReducer(state, { type: "room-state", room: push(room({ code: "XYZ789" })) })).toBe(state);
  });

  it("replace the room and split off the private hold and hints", () => {
    const hint: HintEntry = { puzzleKey: "blackreef-cipher", level: 1, text: "Look west.", paidWith: "strike", boughtAt: T0 };
    const state = crewReducer(seatedIn(), {
      type: "room-state",
      room: push(room({ players: [ANNE, JACK] }), {
        you: [{ itemKey: "tide-rumor", name: "Tide Rumor", description: "", quantity: 2 }],
        yourHints: [hint],
      }),
    });
    expect(state.room?.players).toHaveLength(2);
    expect(state.room).not.toHaveProperty("you");
    expect(state.you[0].quantity).toBe(2);
    expect(state.hints).toEqual([hint]);
  });

  it("clear a countdown when the crew is back in the lobby", () => {
    const counting = crewReducer(seatedIn(), { type: "voyage-starting", startsAt: T0 + 3000, seconds: 3, at: T0 });
    const back = crewReducer(counting, { type: "room-state", room: push(room({ phase: "lobby" })) });
    expect(back.countdown).toBeNull();
  });

  it("mark the voyage started once the room is in game", () => {
    const state = crewReducer(seatedIn(), { type: "room-state", room: push(room({ phase: "in-game", voyage: voyage() })) });
    expect(state.voyageStarted).toBe(true);
  });

  it("pick up the outcome from a finished room", () => {
    const finished = voyage({ status: "finished", finishReason: "wreck", finishedAt: T0 });
    const state = crewReducer(seatedIn(), { type: "room-state", room: push(room({ phase: "finished", voyage: finished })) });
    expect(state.voyageFinished).toBe(true);
    expect(state.outcome?.reason).toBe("wreck");
  });
});

/* ------------------------------------------------------------------ */
/* Lobby pushes                                                        */
/* ------------------------------------------------------------------ */

describe("lobby pushes", () => {
  it("add a sailor who climbs aboard, once", () => {
    let state = crewReducer(seatedIn(), { type: "player-joined", player: JACK, at: T0 });
    state = crewReducer(state, { type: "player-joined", player: JACK, at: T0 });
    expect(state.room?.players.map((p) => p.id)).toEqual([ANNE.id, JACK.id]);
    expect(lastLine(state)?.text).toBe("Calico Jack climbed aboard.");
  });

  it.each([
    ["left", "Calico Jack went ashore."],
    ["kicked", "Calico Jack was cast overboard."],
    ["disconnected", "Calico Jack vanished into the fog."],
  ] as const)("word a departure for reason %s", (reason, text) => {
    const aboard = seatedIn(room({ players: [ANNE, JACK] }));
    const state = crewReducer(aboard, { type: "player-left", playerId: JACK.id, name: JACK.name, reason, at: T0 });
    expect(state.room?.players.map((p) => p.id)).toEqual([ANNE.id]);
    expect(lastLine(state)).toMatchObject({ tone: "leave", text });
  });

  it("log a sailor readying up and standing down", () => {
    const aboard = seatedIn(room({ players: [ANNE, JACK] }));
    const ready = crewReducer(aboard, { type: "player-updated", player: { ...JACK, isReady: true }, at: T0 });
    expect(lastLine(ready)).toMatchObject({ tone: "ready", text: "Calico Jack is ready to weigh anchor." });
    const unready = crewReducer(ready, { type: "player-updated", player: JACK, at: T0 });
    expect(lastLine(unready)?.text).toBe("Calico Jack needs a moment more.");
  });

  it("log a sailor losing and regaining the connection", () => {
    const aboard = seatedIn(room({ players: [ANNE, JACK] }));
    const lost = crewReducer(aboard, { type: "player-updated", player: { ...JACK, isConnected: false }, at: T0 });
    expect(lastLine(lost)).toMatchObject({ tone: "leave", text: "Calico Jack lost sight of the ship." });
    const back = crewReducer(lost, { type: "player-updated", player: JACK, at: T0 });
    expect(lastLine(back)).toMatchObject({ tone: "join", text: "Calico Jack emerged from the fog." });
  });

  it("do not log an update that changed nothing worth saying", () => {
    const aboard = seatedIn(room({ players: [ANNE, JACK] }));
    const state = crewReducer(aboard, { type: "player-updated", player: { ...JACK, avatarId: "gunner" }, at: T0 });
    expect(state.log).toHaveLength(aboard.log.length);
    expect(state.room?.players[1].avatarId).toBe("gunner");
  });

  it("move the captain's hat", () => {
    const aboard = seatedIn(room({ players: [ANNE, JACK] }));
    const state = crewReducer(aboard, { type: "captain-changed", captainId: JACK.id, at: T0 });
    expect(state.room?.captainId).toBe(JACK.id);
    expect(state.room?.players.map((p) => p.isCaptain)).toEqual([false, true]);
    expect(lastLine(state)).toMatchObject({ tone: "captain", text: "Calico Jack now holds the helm." });
  });

  it("make every other sailor ready up again after the articles change", () => {
    const crew = [ANNE, { ...JACK, isReady: true }, { ...MARY, isReady: true }];
    const aboard = seatedIn(room({ players: crew }), JACK.id);
    const settings = { ...DEFAULT_SETTINGS, maxStrikes: 2, hintsEnabled: false };
    const state = crewReducer(aboard, { type: "settings-changed", settings, changedBy: ANNE.id, at: T0 });

    expect(state.room?.settings).toEqual(settings);
    expect(state.room?.players.map((p) => p.isReady)).toEqual([false, false, false]);
    expect(lastLine(state)?.text).toBe(
      "Anne Bonny rewrote the articles: strikes allowed 3 → 2, hints forbidden. Every sailor must ready up again.",
    );
  });

  it("keep the changer's own ready flag and stay quiet when nothing changed", () => {
    const aboard = seatedIn(room({ players: [{ ...ANNE, isReady: true }, { ...JACK, isReady: true }] }));
    const state = crewReducer(aboard, { type: "settings-changed", settings: DEFAULT_SETTINGS, changedBy: ANNE.id, at: T0 });
    expect(state.room?.players.map((p) => p.isReady)).toEqual([true, false]);
    expect(state.log).toHaveLength(aboard.log.length);
  });

  it("are ignored before a seat is taken", () => {
    expect(run({ type: "player-joined", player: JACK, at: T0 })).toBe(initialCrewState);
    expect(run({ type: "captain-changed", captainId: JACK.id, at: T0 })).toBe(initialCrewState);
  });
});

/* ------------------------------------------------------------------ */
/* Setting sail                                                        */
/* ------------------------------------------------------------------ */

describe("setting sail", () => {
  it("starts a countdown and marks the ship as starting", () => {
    const state = crewReducer(seatedIn(), { type: "voyage-starting", startsAt: T0 + 3000, seconds: 3, at: T0 });
    expect(state.countdown).toEqual({ startsAt: T0 + 3000, seconds: 3 });
    expect(state.room?.phase).toBe("starting");
    expect(lastLine(state)?.text).toBe("The captain orders: weigh anchor!");
  });

  it("leaves harbour with a clean event counter", () => {
    const counting = crewReducer(seatedIn(), { type: "voyage-starting", startsAt: T0, seconds: 3, at: T0 });
    const state = crewReducer(counting, { type: "voyage-started", at: T0 });
    expect(state).toMatchObject({ voyageStarted: true, countdown: null, lastSeq: 0, needsSync: false });
    expect(state.room?.phase).toBe("in-game");
    expect(lastLine(state)?.tone).toBe("voyage");
  });
});

/* ------------------------------------------------------------------ */
/* Voyage events                                                       */
/* ------------------------------------------------------------------ */

describe("voyage events", () => {
  const sailing = () => seatedIn(room({ phase: "in-game", players: [ANNE, JACK], voyage: voyage() }));

  it("are written to the log once", () => {
    const moved = gameEvent(1, "MOVED", JACK.id, { islandKey: "goldmouth" });
    let state = crewReducer(sailing(), { type: "game-event", event: moved });
    state = crewReducer(state, { type: "game-event", event: moved });
    expect(state.log.filter((l) => l.eventId === moved.id)).toHaveLength(1);
    expect(lastLine(state)?.text).toBe("Calico Jack dropped anchor at Goldmouth.");
  });

  it("raise the alarm when one goes missing", () => {
    let state = crewReducer(sailing(), { type: "game-event", event: gameEvent(1, "MOVED", JACK.id, { islandKey: "blackreef" }) });
    state = crewReducer(state, { type: "game-event", event: gameEvent(3, "MOVED", JACK.id, { islandKey: "goldmouth" }) });
    expect(state.needsSync).toBe(true);
    expect(state.lastSeq).toBe(3);
  });

  it("do not raise the alarm for the very first event", () => {
    const state = crewReducer(sailing(), { type: "game-event", event: gameEvent(5, "MOVED", JACK.id, { islandKey: "blackreef" }) });
    expect(state.needsSync).toBe(false);
  });

  it("clear the alarm once a sync begins", () => {
    let state = crewReducer(sailing(), { type: "game-event", event: gameEvent(1, "MOVED", JACK.id, { islandKey: "blackreef" }) });
    state = crewReducer(state, { type: "game-event", event: gameEvent(4, "MOVED", JACK.id, { islandKey: "goldmouth" }) });
    state = crewReducer(state, { type: "sync-started" });
    expect(state.needsSync).toBe(false);
  });

  it("fill the gap from a replay, in order", () => {
    let state = crewReducer(sailing(), { type: "game-event", event: gameEvent(1, "MOVED", JACK.id, { islandKey: "blackreef" }) });
    state = crewReducer(state, {
      type: "events-replayed",
      events: [
        gameEvent(3, "PUZZLE_SOLVED", JACK.id, { islandKey: "blackreef" }),
        gameEvent(2, "PUZZLE_FAILED", JACK.id, { islandKey: "blackreef" }),
      ],
      lastSeq: 7,
    });
    expect(state.log.slice(-2).map((l) => l.text)).toEqual([
      "Calico Jack answered wrongly at Blackreef.",
      "Calico Jack cracked the riddle of Blackreef.",
    ]);
    expect(state.lastSeq).toBe(7);
    expect(state.needsSync).toBe(false);
  });

  it("keep the log to its newest sixty lines", () => {
    let state = sailing();
    for (let i = 1; i <= 80; i += 1) {
      state = crewReducer(state, { type: "game-event", event: gameEvent(i, "MOVED", JACK.id, { islandKey: "blackreef" }) });
    }
    expect(state.log).toHaveLength(60);
    expect(state.log.at(-1)?.eventId).toBe("evt-80");
  });
});

/* ------------------------------------------------------------------ */
/* The end of the voyage                                               */
/* ------------------------------------------------------------------ */

describe("the end of the voyage", () => {
  const sailing = () => seatedIn(room({ phase: "in-game", players: [ANNE, JACK], voyage: voyage() }));
  const finish = (state: CrewState, winnerPlayerId: string | null, reason: "treasure" | "time" | "wreck") =>
    crewReducer(state, { type: "voyage-finished", winnerPlayerId, reason, scores: [], at: T0 + 9000 });

  it("crowns this sailor", () => {
    const state = finish(sailing(), ANNE.id, "treasure");
    expect(state.voyageFinished).toBe(true);
    expect(state.room?.phase).toBe("finished");
    expect(state.outcome).toEqual({ winnerPlayerId: ANNE.id, reason: "treasure", scores: [], at: T0 + 9000 });
    expect(lastLine(state)).toMatchObject({ tone: "treasure", text: "You claimed the hoard." });
  });

  it("crowns a crewmate", () => {
    expect(lastLine(finish(sailing(), JACK.id, "treasure"))?.text).toBe("Calico Jack claimed the hoard.");
  });

  it("names a winner on points when the clock ran out", () => {
    expect(lastLine(finish(sailing(), JACK.id, "time"))?.text).toBe("Calico Jack takes the day on points.");
  });

  it("mourns a wrecked crew", () => {
    expect(lastLine(finish(sailing(), null, "wreck"))).toMatchObject({
      tone: "trap",
      text: "The voyage ends in wreckage. No one claims the hoard.",
    });
  });

  it("admits when nobody won", () => {
    expect(lastLine(finish(sailing(), null, "time"))).toMatchObject({ tone: "clock", text: "The tide turned with no clear victor." });
  });

  it("only ends once", () => {
    const ended = finish(sailing(), ANNE.id, "treasure");
    expect(finish(ended, JACK.id, "treasure")).toBe(ended);
  });
});

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

describe("crew chat", () => {
  it("counts unread messages from crewmates while the chat is closed", () => {
    let state = crewReducer(seatedIn(), { type: "chat-message", message: chat("a", 1, JACK.id) });
    state = crewReducer(state, { type: "chat-message", message: chat("b", 2, ANNE.id) });
    expect(state.unreadChat).toBe(1);
  });

  it("does not count messages while the chat is open", () => {
    let state = crewReducer(seatedIn(), { type: "chat-visibility", open: true });
    state = crewReducer(state, { type: "chat-message", message: chat("a", 1, JACK.id) });
    expect(state.unreadChat).toBe(0);
  });

  it("clears the count when the chat opens", () => {
    let state = crewReducer(seatedIn(), { type: "chat-message", message: chat("a", 1, JACK.id) });
    state = crewReducer(state, { type: "chat-visibility", open: true });
    expect(state.unreadChat).toBe(0);
  });

  it("ignores a message it already has", () => {
    const once = crewReducer(seatedIn(), { type: "chat-message", message: chat("a", 1, JACK.id) });
    expect(crewReducer(once, { type: "chat-message", message: chat("a", 1, JACK.id) })).toBe(once);
  });

  it("keeps messages in order and only the newest hundred", () => {
    let state = seatedIn();
    for (let i = CHAT_HISTORY_LIMIT + 10; i >= 1; i -= 1) {
      state = crewReducer(state, { type: "chat-message", message: chat(`m${i}`, i, JACK.id) });
    }
    expect(state.chat).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(state.chat[0].seq).toBe(11);
    expect(state.chat.at(-1)?.seq).toBe(CHAT_HISTORY_LIMIT + 10);
  });
});

describe("resetting", () => {
  it("forgets everything but keeps log ids unique", () => {
    const state = crewReducer(seatedIn(), { type: "reset" });
    expect(state).toEqual({ ...initialCrewState, logSeq: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* Describing events                                                   */
/* ------------------------------------------------------------------ */

describe("describeVoyageEvent", () => {
  const snapshot = room({ phase: "in-game", players: [ANNE, JACK], voyage: voyage() });
  const say = (type: string, playerId: string | null, payload: Record<string, unknown> = {}, you = [] as CrewState["you"]) =>
    describeVoyageEvent(snapshot, gameEvent(1, type, playerId, payload), ANNE.id, you);

  it("speaks to this sailor in the second person", () => {
    expect(say("MOVED", ANNE.id, { islandKey: "blackreef" })?.text).toBe("You dropped anchor at Blackreef.");
  });

  it("describes a lifted fog", () => {
    expect(say("ISLAND_DISCOVERED", null, { islandKey: "goldmouth" })).toEqual({
      tone: "discover",
      text: "Goldmouth emerged from the fog.",
    });
  });

  it("counts strikes against the crew's articles", () => {
    expect(say("TRAP_TRIGGERED", JACK.id, { islandKey: "kraken-shoal", strikes: 2, eliminated: false })?.text).toBe(
      "Calico Jack sprang a trap at Kraken Shoal — strike 2/3.",
    );
  });

  it("mourns an eliminated sailor in the right person", () => {
    expect(say("TRAP_TRIGGERED", JACK.id, { islandKey: "kraken-shoal", strikes: 3, eliminated: true })?.text).toMatch(
      /The sea has claimed them\.$/,
    );
    expect(say("TRAP_TRIGGERED", ANNE.id, { islandKey: "kraken-shoal", strikes: 3, eliminated: true })?.text).toMatch(
      /The sea has claimed you\.$/,
    );
  });

  it("names items from the sailor's own hold when it can", () => {
    const you = [{ itemKey: "compass", name: "Brass Compass", description: "", quantity: 1 }];
    expect(say("ITEM_GRANTED", ANNE.id, { itemKey: "compass" }, you)?.text).toBe("You recovered the Brass Compass.");
  });

  it("falls back to a readable item name", () => {
    expect(say("ITEM_GRANTED", JACK.id, { itemKey: "widow-chart" })?.text).toBe("Calico Jack recovered the Widow Chart.");
  });

  it("treats a cursed coin as bad news", () => {
    expect(say("ITEM_GRANTED", ANNE.id, { itemKey: "cursed-coin" })).toEqual({ tone: "trap", text: "You were handed a Cursed Coin." });
  });

  it("describes trades of one and of many", () => {
    expect(say("TRADED", JACK.id, { itemKey: "tide-rumor", quantity: 1, fromPlayerId: JACK.id, toPlayerId: ANNE.id })?.text).toBe(
      "Calico Jack passed a Tide Rumor to You.",
    );
    expect(say("TRADED", JACK.id, { itemKey: "tide-rumor", quantity: 3, fromPlayerId: JACK.id, toPlayerId: ANNE.id })?.text).toBe(
      "Calico Jack passed 3 × Tide Rumor to You.",
    );
  });

  it("announces the Vault and the treasure", () => {
    expect(say("VAULT_AWAKENED", ANNE.id)?.text).toBe("Five relics hum in your pack. The Vault has awakened.");
    expect(say("VAULT_AWAKENED", JACK.id)?.text).toBe("Five relics hum in Calico Jack's pack. The Vault has awakened.");
    expect(say("TREASURE_FOUND", JACK.id)).toEqual({ tone: "treasure", text: "Calico Jack opened the Vault. The hoard is claimed!" });
  });

  it("describes hints, spectators and the clock", () => {
    expect(say("HINT_BOUGHT", JACK.id, { islandKey: "blackreef", paidWith: "tide-rumor" })?.text).toBe(
      "Calico Jack paid a Tide Rumor for a whisper about Blackreef.",
    );
    expect(say("SPECTATING", JACK.id, { targetId: ANNE.id })?.text).toBe("Calico Jack now watches You from the rigging.");
    expect(say("SPECTATING", JACK.id, { targetId: null })?.text).toBe("Calico Jack stopped watching from the rigging.");
    expect(say("TIME_WARNING", null, { minutesLeft: 1 })?.text).toBe("1 minute remains before the tide turns.");
    expect(say("TIME_WARNING", null, { minutesLeft: 5 })?.text).toBe("5 minutes remain before the tide turns.");
  });

  it("skips arrivals, which the lobby already logged", () => {
    expect(say("PLAYER_JOINED", JACK.id)).toBeNull();
    expect(say("PLAYER_LEFT", JACK.id)).toBeNull();
  });

  it("copes with sailors, islands and events it does not know", () => {
    expect(say("MOVED", "ghost", { islandKey: "atlantis" })?.text).toBe("A departed sailor dropped anchor at an unknown shore.");
    expect(say("KRAKEN_SIGHTED", JACK.id)).toEqual({ tone: "info", text: "Calico Jack: kraken sighted." });
  });
});

describe("describing the articles", () => {
  it("lists only what changed", () => {
    expect(
      describeSettingsChange(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, trapsEnabled: false, timeLimitMinutes: 15 }),
    ).toEqual(["traps disarmed", "clock no limit → 15 minutes"]);
    expect(describeSettingsChange(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("summarises the articles in one line", () => {
    expect(describeSettings(DEFAULT_SETTINGS)).toBe("3 strikes · traps armed · hints for sale · no clock");
    expect(describeSettings({ maxStrikes: 1, trapsEnabled: false, hintsEnabled: false, timeLimitMinutes: 10 })).toBe(
      "1 strike · traps disarmed · no hints · 10-minute clock",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

describe("selectors", () => {
  it("find this sailor and the captain", () => {
    const state = seatedIn(room({ players: [ANNE, JACK] }), JACK.id);
    expect(selectMe(state)?.id).toBe(JACK.id);
    expect(selectCaptain(state)?.id).toBe(ANNE.id);
    expect(selectMe(initialCrewState)).toBeNull();
  });

  it("fall back to the default articles without a room", () => {
    expect(selectSettings(initialCrewState)).toEqual(DEFAULT_SETTINGS);
  });

  it("count ready sailors", () => {
    expect(readyCount(room({ players: [{ ...ANNE, isReady: true }, JACK] }))).toBe(1);
  });

  it("count relics in the hold, ignoring everything else", () => {
    const state = { ...seatedIn(), you: ["compass", "tide-rumor", "gold-seal"].map((itemKey) => ({ itemKey, name: itemKey, description: "", quantity: 1 })) };
    expect(heldRelicCount(state)).toBe(2);
  });

  it("list a puzzle's hints gentlest first", () => {
    const hint = (level: number): HintEntry => ({ puzzleKey: "kraken-arms", level, text: `Hint ${level}`, paidWith: "strike", boughtAt: T0 });
    const state = { ...seatedIn(), hints: [hint(2), { ...hint(1), puzzleKey: "other" }, hint(1)] };
    expect(hintsFor(state, "kraken-arms").map((h) => h.level)).toEqual([1, 2]);
  });

  it("find who is watching a sailor from the rigging", () => {
    const sailors = [
      { playerId: JACK.id, currentIslandKey: null, strikes: 3, isEliminated: true, hintsUsed: 0, followingId: ANNE.id },
      { playerId: MARY.id, currentIslandKey: null, strikes: 0, isEliminated: false, hintsUsed: 0, followingId: null },
    ];
    const state = seatedIn(room({ phase: "in-game", players: [ANNE, JACK, MARY], voyage: voyage({ sailors }) }));
    expect(watchersOf(state, ANNE.id).map((p) => p.id)).toEqual([JACK.id]);
  });

  it("read a score from the outcome before the voyage", () => {
    const score = (playerId: string, value: number): ScoreEntry => ({ playerId, score: value, solved: 0, relics: 0, strikes: 0, hintsUsed: 0, rank: 1 });
    const live = seatedIn(room({ phase: "in-game", voyage: voyage({ scores: [score(ANNE.id, 100)] }) }));
    expect(selectScore(live, ANNE.id)?.score).toBe(100);
    const done = { ...live, outcome: { winnerPlayerId: ANNE.id, reason: "treasure" as const, scores: [score(ANNE.id, 900)], at: T0 } };
    expect(selectScore(done, ANNE.id)?.score).toBe(900);
    expect(selectScore(done, null)).toBeNull();
  });
});

describe("startBlockers", () => {
  it("explains every reason the captain cannot sail yet", () => {
    expect(startBlockers(room({ players: [ANNE] }))).toEqual(["1 more hand is needed on deck.", "Waiting on Anne Bonny."]);
  });

  it("counts several missing hands", () => {
    expect(startBlockers(room({ minPlayers: 4, players: [{ ...ANNE, isReady: true }] }))[0]).toBe("3 more hands are needed on deck.");
  });

  it("names a sailor lost in the fog", () => {
    const crew = [{ ...ANNE, isReady: true }, { ...JACK, isReady: true, isConnected: false }];
    expect(startBlockers(room({ players: crew }))).toEqual(["A sailor is lost in the fog."]);
  });

  it("refuses once the ship has left", () => {
    const crew = [{ ...ANNE, isReady: true }, { ...JACK, isReady: true }];
    expect(startBlockers(room({ phase: "starting", players: crew }))).toEqual(["The ship has already weighed anchor."]);
  });

  it("is empty when the crew is ready", () => {
    expect(startBlockers(room({ players: [{ ...ANNE, isReady: true }, { ...JACK, isReady: true }] }))).toEqual([]);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [999, "0:01"],
    [61_000, "1:01"],
    [59_001, "1:00"],
    [600_000, "10:00"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
    [-5_000, "0:00"],
  ])("shows %i ms as %s", (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe("toVoyageRoom", () => {
  it("has nothing to show before the voyage", () => {
    expect(toVoyageRoom(room(), [])).toBeNull();
    expect(toVoyageRoom(null, [])).toBeNull();
  });

  it("flattens the room into the voyage screen's view", () => {
    const sailors = [{ playerId: JACK.id, currentIslandKey: "goldmouth", strikes: 2, isEliminated: false, hintsUsed: 1, followingId: null }];
    const snapshot = room({
      phase: "in-game",
      players: [ANNE, sailor(JACK.id, JACK.name, { isConnected: false })],
      voyage: voyage({ sailors, progress: [{ playerId: JACK.id, puzzleKey: "goldmouth-tides", solvedAt: "x" }] }),
    });
    const you = [{ itemKey: "compass", name: "Brass Compass", description: "", quantity: 1 }];
    const view = toVoyageRoom(snapshot, you);

    expect(view).toMatchObject({ code: "ABC234", name: "The Black Gull", status: "ACTIVE", hostId: ANNE.id, you, hints: [] });
    expect(view?.progress).toEqual([{ playerId: JACK.id, puzzleKey: "goldmouth-tides" }]);
    expect(view?.players.find((p) => p.id === JACK.id)).toMatchObject({
      username: "Calico Jack",
      isOnline: false,
      strikes: 2,
      hintsUsed: 1,
      currentIslandKey: "goldmouth",
    });
    expect(view?.players.find((p) => p.id === ANNE.id)).toMatchObject({ isHost: true, strikes: 0, currentIslandKey: null });
  });

  it("marks a finished voyage", () => {
    const snapshot = room({ phase: "finished", voyage: voyage({ status: "finished" }) });
    expect(toVoyageRoom(snapshot, [])?.status).toBe("FINISHED");
  });
});
