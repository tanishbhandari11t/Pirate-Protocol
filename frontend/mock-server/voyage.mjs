// Cooperative voyage for the practice harbour.
// Each sailor gets a private watch whose answer never leaves the server.
// Kept watches reveal clue words; in order of first appearance they name the island.
import { randomBytes } from "node:crypto";

const BRIEFING =
  "Each sailor keeps their own watch. When every watch is kept, the clues name an island. Tap it to win. Three wrong islands and the hoard is lost.";
const CHART_PROMPT = "Read the clues top to bottom. Together they name the island. Tap that island.";
const MAX_STRIKES = 3;

const ISLANDS = ["Skull Cay", "Black Reef", "Gull Rock", "Serpent Isle", "Widow's Reach", "Rum Rock"].map((name) => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  name,
  words: name.split(" "),
}));

const HOARDS = [
  "a chest of doubloons and a cracked emerald",
  "pearls, a gold compass, and a bottle that still sloshes",
  "silver bars and the rival captain's hat",
];

/** [title, option labels, order template]. Every watch is "tap the named option". */
const WATCHES = [
  ["Cipher watch", ["Skull", "Anchor", "Compass", "Lantern"], (x) => `Your scrap names one true rune: ${x}. Tap ${x}.`],
  ["Helm watch", ["North", "East", "South", "West"], (x) => `Set the helm to ${x}. Tap ${x}.`],
  ["Bell watch", ["First bell", "Second bell", "Third bell", "Fourth bell"], (x) => `Strike the ${x.toLowerCase()}. Tap ${x}.`],
  ["Hold watch", ["Rum cask", "Skull crate", "Coil of rope"], (x) => `Stow only the ${x.toLowerCase()}. Tap ${x}.`],
  ["Lantern watch", ["Low flame", "Steady flame", "High flame"], (x) => `Trim the lantern to a ${x.toLowerCase()}. Tap ${x}.`],
];

const rand = (n) => randomBytes(1)[0] % n;
const pick = (list) => list[rand(list.length)];
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function makeWatch([title, labels, orders]) {
  const options = labels.map((label) => ({ id: label.toLowerCase().replace(/\W+/g, "-"), label }));
  const answer = pick(options);
  return { title, orders: orders(answer.label), options: shuffle(options), answer: answer.id };
}

function yourOrders(voyage, player) {
  if (voyage.phase === "won") return `Landfall at ${voyage.islandName}. The hoard is yours — voyage won.`;
  if (voyage.phase === "lost") return "Too many wrong islands. Rival pirates took the chest.";
  if (voyage.phase === "chart") return CHART_PROMPT;
  const duty = voyage.duties.find((item) => item.playerId === player.id);
  if (!duty) return "You have no watch. Stand by until the map opens.";
  if (!duty.done) return duty.orders;
  const waiting = voyage.duties.filter((item) => !item.done).map((item) => item.playerName);
  return `Your watch is kept. Waiting on ${waiting.join(", ")}.`;
}

export function snapshotFor(room, player) {
  const voyage = room.voyage;
  const mine = voyage.duties.find((duty) => duty.playerId === player.id && !duty.done);
  return {
    roomCode: room.code,
    phase: voyage.phase,
    briefing: BRIEFING,
    yourOrders: yourOrders(voyage, player),
    duties: voyage.duties.map(({ playerId, playerName, title, done, abandoned, clue }) => ({
      playerId,
      playerName,
      title,
      done,
      abandoned,
      clue: done ? clue : null,
    })),
    myDuty: mine ? { title: mine.title, orders: mine.orders, options: mine.options } : null,
    chart: voyage.phase === "chart" ? { prompt: CHART_PROMPT, islands: voyage.chartIslands } : null,
    strikes: voyage.strikes,
    maxStrikes: MAX_STRIKES,
    hoard: voyage.phase === "won" ? voyage.hoard : null,
  };
}

const openMapIfDone = (voyage) => {
  if (voyage.phase === "duties" && voyage.duties.every((duty) => duty.done)) voyage.phase = "chart";
};

export function beginVoyage(room) {
  const crew = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  const island = pick(ISLANDS);
  const watches = shuffle(WATCHES);
  room.voyage = {
    phase: "duties",
    strikes: 0,
    hoard: pick(HOARDS),
    islandId: island.id,
    islandName: island.name,
    chartIslands: shuffle([island, ...shuffle(ISLANDS.filter((item) => item !== island)).slice(0, 2)]).map(
      ({ id, name }) => ({ id, name }),
    ),
    duties: crew.map((player, i) => ({
      playerId: player.id,
      playerName: player.name,
      clue: island.words[i % island.words.length],
      done: false,
      abandoned: false,
      ...makeWatch(watches[i % watches.length]),
    })),
  };
}

/** A sailor left mid-watch. Their clue is still revealed so the crew is not stuck. */
export function abandonDuty(room, playerId) {
  const voyage = room.voyage;
  const duty = voyage?.phase === "duties" && voyage.duties.find((item) => item.playerId === playerId);
  if (!duty || duty.done) return;
  duty.done = duty.abandoned = true;
  openMapIfDone(voyage);
}

export function act(room, player, payload) {
  const voyage = room.voyage;
  const result = (correct, message) => ({ correct, message, voyage: snapshotFor(room, player) });

  if (voyage.phase === "won" || voyage.phase === "lost") return result(voyage.phase === "won", "The voyage is over.");

  if (payload.kind === "duty") {
    const duty = voyage.duties.find((item) => item.playerId === player.id);
    if (voyage.phase !== "duties" || !duty || duty.done) return result(false, "You have no watch to keep.");
    if (payload.choice !== duty.answer) return result(false, "That is not what your orders say. Try again.");
    duty.done = true;
    openMapIfDone(voyage);
    return result(true, voyage.phase === "chart" ? "Every watch is kept. Name the island!" : "Watch kept. Your clue is on the list.");
  }

  if (voyage.phase !== "chart") return result(false, "The map is still shut. Every watch must be kept first.");
  if (payload.choice === voyage.islandId) {
    voyage.phase = "won";
    room.phase = "finished";
    return result(true, `Landfall at ${voyage.islandName}! Inside the chest: ${voyage.hoard}.`);
  }
  voyage.strikes += 1;
  if (voyage.strikes >= MAX_STRIKES) {
    voyage.phase = "lost";
    room.phase = "finished";
    return result(false, "That was the last mistake. Rival pirates have the chest.");
  }
  const left = MAX_STRIKES - voyage.strikes;
  return result(false, `Wrong island. ${left} mistake${left === 1 ? "" : "s"} left.`);
}
