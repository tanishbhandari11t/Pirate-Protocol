import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const root = join(here, "..", ".next");
/** rel → hash → { first, last, content } */
const versions = new Map();

function walk(dir) {
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (name.endsWith(".map")) scan(p, s.mtimeMs);
  }
}

function scan(file, mtime) {
  let map;
  try {
    map = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return;
  }
  const maps = map.sections ? map.sections.map((s) => s.map) : [map];
  for (const m of maps) {
    (m.sources ?? []).forEach((src, i) => {
      const content = m.sourcesContent?.[i];
      if (!content) return;
      const at = src.lastIndexOf("frontend/");
      if (at < 0) return;
      const rel = decodeURIComponent(src.slice(at + "frontend/".length)).replace(/\?.*$/, "");
      if (!/^(src|mock-server)\//.test(rel)) return;
      const hash = createHash("sha1").update(content).digest("hex").slice(0, 8);
      const byHash = versions.get(rel) ?? new Map();
      const v = byHash.get(hash) ?? { first: mtime, last: mtime, content };
      v.first = Math.min(v.first, mtime);
      v.last = Math.max(v.last, mtime);
      byHash.set(hash, v);
      versions.set(rel, byHash);
    });
  }
}

walk(root);
const index = {};
for (const [rel, byHash] of versions) {
  index[rel] = [];
  for (const [hash, v] of byHash) {
    const target = join(here, "versions", rel, `${hash}.txt`);
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, v.content);
    } catch {
      continue;
    }
    index[rel].push({ hash, first: new Date(v.first).toISOString(), last: new Date(v.last).toISOString(), lines: v.content.split("\n").length });
  }
  index[rel].sort((a, b) => a.last.localeCompare(b.last));
}
writeFileSync(join(here, "index.json"), JSON.stringify(index, null, 1));
console.log(Object.keys(index).length, "files");
