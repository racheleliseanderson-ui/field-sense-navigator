/**
 * Fail the build if the assembled destination catalog is missing, empty,
 * duplicated across shards, placeholder data, or unparseable.
 * Guards against the PLACEHOLDER_DEST regression and shard drift.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const basePath = join(root, "src/data/destinations.json");
const shardDir = join(root, "src/data/destinations");

function readArray(path) {
  const raw = readFileSync(path, "utf8").trim();
  if (!raw || raw === "PLACEHOLDER_DEST" || raw.startsWith("PLACEHOLDER")) {
    throw new Error(`${path} is a placeholder or empty`);
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`${path} must contain a JSON array`);
  return data;
}

let records;
try {
  const base = readArray(basePath);
  const shardFiles = existsSync(shardDir)
    ? readdirSync(shardDir)
        .filter((name) => name.endsWith(".json"))
        .sort()
    : [];
  records = [
    ...base,
    ...shardFiles.flatMap((name) => readArray(join(shardDir, name))),
  ];
} catch (err) {
  console.error("assert-catalog: catalog is not valid", err);
  process.exit(1);
}

if (records.length < 500) {
  console.error(`assert-catalog: expected >=500 destination records, got ${records.length}`);
  process.exit(1);
}

const seen = new Set();
for (const d of records) {
  if (!d || typeof d.id !== "string" || !d.id.startsWith("HHI-DEST-")) {
    console.error("assert-catalog: one or more records lack a valid HHI-DEST- id");
    process.exit(1);
  }
  if (seen.has(d.id)) {
    console.error(`assert-catalog: duplicate destination id across base/shards: ${d.id}`);
    process.exit(1);
  }
  seen.add(d.id);
}

console.log(`assert-catalog: ok (${records.length} records across base + shards)`);
