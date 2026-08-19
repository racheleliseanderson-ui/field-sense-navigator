/**
 * Fail the build if destinations.json is missing, empty, a placeholder, or unparseable.
 * Guards against the PLACEHOLDER_DEST regression that broke production deploys.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "src/data/destinations.json");
const raw = readFileSync(path, "utf8").trim();

if (!raw || raw === "PLACEHOLDER_DEST" || raw.startsWith("PLACEHOLDER")) {
  console.error(`assert-catalog: ${path} is a placeholder or empty`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error(`assert-catalog: ${path} is not valid JSON`, err);
  process.exit(1);
}

if (!Array.isArray(data) || data.length < 500) {
  console.error(
    `assert-catalog: expected ≥500 destination records, got ${Array.isArray(data) ? data.length : typeof data}`,
  );
  process.exit(1);
}

if (!data.every((d) => d && typeof d.id === "string" && d.id.startsWith("HHI-DEST-"))) {
  console.error("assert-catalog: one or more records lack a valid HHI-DEST- id");
  process.exit(1);
}

console.log(`assert-catalog: ok (${data.length} records)`);
