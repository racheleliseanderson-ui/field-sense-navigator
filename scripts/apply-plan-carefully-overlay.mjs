/**
 * Merge Plan carefully overlay fields into destinations.json (prebuild).
 * Accepts plan-carefully-overlay.json and optional -a/-b split files.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destPath = join(root, "src/data/destinations.json");
const candidates = [
  "src/data/plan-carefully-overlay.json",
  "src/data/plan-carefully-overlay-a.json",
  "src/data/plan-carefully-overlay-b.json",
].map((p) => join(root, p));

const overlay = [];
for (const p of candidates) {
  if (!existsSync(p)) continue;
  const part = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(part)) {
    console.error(`apply-plan-carefully-overlay: ${p} is not an array`);
    process.exit(1);
  }
  overlay.push(...part);
}

if (overlay.length === 0) {
  console.log("apply-plan-carefully-overlay: no overlay file, skip");
  process.exit(0);
}

const dest = JSON.parse(readFileSync(destPath, "utf8"));
if (!Array.isArray(dest)) {
  console.error("apply-plan-carefully-overlay: destinations.json is not an array");
  process.exit(1);
}

const byId = new Map(overlay.map((row) => [row.id, row]));
let n = 0;
for (const row of dest) {
  const patch = byId.get(row.id);
  if (!patch) continue;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    row[k] = v;
  }
  n += 1;
}

writeFileSync(destPath, JSON.stringify(dest, null, 2) + "\n");
console.log(
  `apply-plan-carefully-overlay: merged ${n} records from ${overlay.length} overlay rows`,
);
