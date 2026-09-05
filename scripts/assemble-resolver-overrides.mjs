#!/usr/bin/env node
/**
 * Temporarily assemble the canonical station override file plus additive
 * verification shards for resolver runs. Restore the canonical base file
 * before publishing generated resolver data.
 */
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PATH = resolve(ROOT, "src/data/station-overrides.json");
const SHARD_DIR = resolve(ROOT, "src/data/station-overrides");
const BACKUP_PATH = resolve(ROOT, ".resolver-station-overrides-base.json");
const RESTORE = process.argv.includes("--restore");

function readObject(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || !Array.isArray(value.records)) {
    throw new Error(`${path} must contain an object with a records array`);
  }
  return value;
}

if (RESTORE) {
  if (existsSync(BACKUP_PATH)) {
    renameSync(BACKUP_PATH, BASE_PATH);
    console.error("resolver station overrides restored to sharded source state");
  } else {
    console.error("resolver station override restore skipped: no backup present");
  }
  process.exit(0);
}

if (existsSync(BACKUP_PATH)) {
  throw new Error(`resolver override backup already exists: ${BACKUP_PATH}`);
}

const base = readObject(BASE_PATH);
const shardFiles = existsSync(SHARD_DIR)
  ? readdirSync(SHARD_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort()
  : [];
const shardRecords = shardFiles.flatMap((name) => readObject(resolve(SHARD_DIR, name)).records);
const records = [...base.records, ...shardRecords];

const seen = new Set();
for (const row of records) {
  const id = row?.destinationId;
  if (typeof id !== "string" || !id.startsWith("HHI-DEST-")) {
    throw new Error(`resolver overrides contain invalid destination id: ${String(id)}`);
  }
  if (seen.has(id)) throw new Error(`resolver overrides contain duplicate id ${id}`);
  seen.add(id);
  if (!row.agency || !row.siteId) {
    throw new Error(`resolver override ${id} must declare agency and siteId`);
  }
}

copyFileSync(BASE_PATH, BACKUP_PATH);
writeFileSync(BASE_PATH, `${JSON.stringify({ ...base, records }, null, 2)}\n`);
console.error(
  `resolver overrides assembled ${records.length} records (${base.records.length} base + ${shardRecords.length} shard)`,
);
