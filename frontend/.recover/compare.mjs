import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const front = join(here, "..");
const cutoff = process.argv[2] ?? "2026-10-04T09:00:00.000Z";
const index = JSON.parse(readFileSync(join(here, "index.json"), "utf8"));
const norm = (s) => s.replace(/\r\n/g, "\n");

for (const [rel, list] of Object.entries(index)) {
  if (rel.endsWith(".css")) continue;
  const before = list.filter((v) => v.last < cutoff);
  if (!before.length) continue;
  const pick = before[before.length - 1];
  const old = norm(readFileSync(join(here, "versions", rel, `${pick.hash}.txt`), "utf8"));
  const path = join(front, rel);
  const now = existsSync(path) ? norm(readFileSync(path, "utf8")) : null;
  if (now === old) continue;
  const nowLines = now === null ? "MISSING" : now.split("\n").length;
  console.log(`${rel.padEnd(52)} pre-reset ${pick.hash} ${String(pick.lines).padStart(4)}  now ${nowLines}`);
}
