#!/usr/bin/env node
/**
 * Temporarily assemble the base catalog plus every jurisdiction shard into
 * src/data/destinations.json for legacy resolver scripts that still consume a
 * single JSON file. Restore the base file before a PR is opened so shard
 * records are never duplicated in application data.
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
const BASE_PATH = resolve(ROOT, "src/data/destinations.json");
const SHARD_DIR = resolve(ROOT, "src/data/destinations");
const BACKUP_PATH = resolve(ROOT, ".resolver-destinations-base.json");
const RESTORE = process.argv.includes("--restore");

function readArray(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(value)) throw new Error(`${path} must contain a JSON array`);
  return value;
}

if (RESTORE) {
  if (existsSync(BACKUP_PATH)) {
    renameSync(BACKUP_PATH, BASE_PATH);
    console.error("resolver catalog restored to sharded source state");
  } else {
    console.error("resolver catalog restore skipped: no backup present");
  }
  process.exit(0);
}

if (existsSync(BACKUP_PATH)) {
  throw new Error(`resolver catalog backup already exists: ${BACKUP_PATH}`);
}

const base = readArray(BASE_PATH);
const shardFiles = existsSync(SHARD_DIR)
  ? readdirSync(SHARD_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort()
  : [];
const shardRecords = shardFiles.flatMap((name) => readArray(resolve(SHARD_DIR, name)));
const assembled = [...base, ...shardRecords];

const seen = new Set();
for (const row of assembled) {
  const id = row?.id;
  if (typeof id !== "string" || !id.startsWith("HHI-DEST-")) {
    throw new Error(`resolver catalog contains an invalid destination id: ${String(id)}`);
  }
  if (seen.has(id)) throw new Error(`resolver catalog contains duplicate id ${id}`);
  seen.add(id);
}

copyFileSync(BASE_PATH, BACKUP_PATH);
writeFileSync(BASE_PATH, `${JSON.stringify(assembled, null, 2)}\n`);
console.error(
  `resolver catalog assembled ${assembled.length} records (${base.length} base + ${shardRecords.length} shard)`,
);
