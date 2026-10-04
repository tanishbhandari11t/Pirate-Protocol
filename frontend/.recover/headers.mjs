import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const index = JSON.parse(readFileSync(join(here, "index.json"), "utf8"));
const targets = process.argv.slice(2);

/** Flags snapshots taken mid-retype: Phase 1 leftovers, or the same name imported twice. */
for (const rel of targets) {
  console.log(`== ${rel}`);
  for (const v of index[rel] ?? []) {
    const text = readFileSync(join(here, "versions", rel, `${v.hash}.txt`), "utf8");
    const names = [...text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}/gm)].flatMap((m) =>
      m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()).filter(Boolean),
    );
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    const phase1 = /TreasureMapSketch|from "@\/lib\/names"/.test(text);
    console.log(`  ${v.hash} ${v.last} ${String(v.lines).padStart(4)} lines  dupImports=[${dup.join(",")}] phase1=${phase1}`);
  }
}
