// Plays a two-sailor voyage end to end against the practice harbour.
import { io } from "socket.io-client";

const URL = process.env.SOCKET_URL ?? "http://localhost:4000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sailor() {
  const socket = io(URL, { transports: ["websocket"] });
  const hand = { socket, voyage: null };
  socket.on("voyage:state", (v) => (hand.voyage = v));
  hand.req = async (event, payload = {}) => {
    const res = await socket.timeout(5000).emitWithAck(event, payload);
    if (!res.ok) throw new Error(`${event}: ${res.error.code}`);
    return res.data;
  };
  return hand;
}

async function until(check, label) {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const [anne, billy] = [sailor(), sailor()];
const { room } = await anne.req("crew:create", { playerName: "Anne", avatarId: "captain", crewName: "The Waking Map" });
await billy.req("crew:join", { playerName: "Billy", avatarId: "navigator", roomCode: room.code });
for (const hand of [anne, billy]) await hand.req("player:ready", { ready: true });
await anne.req("game:start");
await until(() => anne.voyage && billy.voyage, "orders");

for (const hand of [anne, billy]) {
  const duty = hand.voyage.myDuty;
  console.log(duty.orders);
  const option = duty.options.find((o) => duty.orders.includes(`Tap ${o.label}.`));
  await hand.req("game:act", { kind: "duty", choice: option.id });
}

await until(() => anne.voyage.phase === "chart", "map");
const name = [...new Set(anne.voyage.duties.map((d) => d.clue))].join(" ");
const island = anne.voyage.chart.islands.find((i) => i.name === name);
const { voyage } = await billy.req("game:act", { kind: "chart", choice: island.id });
if (voyage.phase !== "won") throw new Error(`expected win, got ${voyage.phase}`);
console.log(`Won at ${name}: ${voyage.hoard}`);
anne.socket.close();
billy.socket.close();
console.log("PLAYTHROUGH_OK");
