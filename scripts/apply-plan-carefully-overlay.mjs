/**
 * Merge Plan carefully overlay fields into destinations.json.
 * Runs at prebuild so Vercel ships the enrichment without requiring a 1.4MB
 * API upload of the full catalog. Idempotent.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const overlayPath = join(root, "src/data/plan-carefully-overlay.json");
const destPath = join(root, "src/data/destinations.json");

if (!existsSync(overlayPath)) {
  console.log("apply-plan-carefully-overlay: no overlay file, skip");
  process.exit(0);
}

const overlay = JSON.parse(readFileSync(overlayPath, "utf8"));
const dest = JSON.parse(readFileSync(destPath, "utf8"));
if (!Array.isArray(overlay) || !Array.isArray(dest)) {
  console.error("apply-plan-carefully-overlay: expected arrays");
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
console.log(`apply-plan-carefully-overlay: merged ${n} records`);
