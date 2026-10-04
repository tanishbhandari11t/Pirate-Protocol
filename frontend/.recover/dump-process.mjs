import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const pid = Number(process.argv[2]);
const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
process._debugProcess(pid);
await new Promise((r) => setTimeout(r, 1500));

const targets = await (await fetch("http://127.0.0.1:9229/json/list")).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const scripts = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result);
  if (msg.method === "Debugger.scriptParsed" && /mock-server/.test(msg.params.url)) scripts.push(msg.params);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
await new Promise((r) => (ws.onopen = r));
await send("Debugger.enable");
await new Promise((r) => setTimeout(r, 1000));
for (const s of scripts) {
  const { scriptSource } = await send("Debugger.getScriptSource", { scriptId: s.scriptId });
  const name = s.url.split("/").pop();
  const target = join(here, "process", name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, scriptSource);
  console.log(s.url, scriptSource.split("\n").length, "lines");
}
await send("Debugger.disable");
ws.close();
process.exit(0);
