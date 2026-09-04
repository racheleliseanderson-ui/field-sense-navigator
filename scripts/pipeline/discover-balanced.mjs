#!/usr/bin/env node
/**
 * Balanced discovery coordinator for Field Sense Navigator.
 *
 * The core discover.mjs intentionally learns hosts/folders from the catalog,
 * but its default host ordering favors jurisdictions that already have the
 * most records. This coordinator reverses that bias: it asks the least-covered
 * jurisdictions first and caps each jurisdiction so one strong agency cannot
 * consume the whole run.
 *
 * It does NOT write catalog records. It only invokes discover.mjs, which writes
 * questions to seed-targets.json. resolve-targets.mjs still has to prove every
 * page before seed-destinations.mjs can add anything.
 *
 * Examples:
 *   node scripts/pipeline/discover-balanced.mjs
 *   node scripts/pipeline/discover-balanced.mjs --target=200 --per-state=8
 *   node scripts/pipeline/discover-balanced.mjs --state=Arizona --target=25
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  PATHS,
  readCatalog,
  readJson,
  writeJson,
  argv,
  writeReport,
  appendRun,
  note,
} from "./lib.mjs";

const args = argv();
const TARGET = Math.max(1, Number(args.target) || 200);
const PER_STATE = Math.max(1, Number(args["per-state"]) || 8);
const MAX_JURISDICTIONS = Math.max(1, Number(args.jurisdictions) || 45);
const PER_HOST = Math.max(1, Number(args["per-host"]) || PER_STATE);
const CONCURRENCY = Math.max(1, Math.min(4, Number(args.concurrency ?? 3)));
const MAX_HOSTS = Math.max(1, Number(args["max-hosts"]) || 12);
const ONLY_STATE = args.state ? String(args.state).trim() : null;
const DRY = Boolean(args.dry);
const COOLDOWN_HOURS = Math.max(0, Number(args["cooldown-hours"] ?? 18));
const IGNORE_COOLDOWN = Boolean(args["ignore-cooldown"]);

const discoverPath = fileURLToPath(new URL("./discover.mjs", import.meta.url));
const progressPath = fileURLToPath(new URL("../data/discovery-progress.json", import.meta.url));
const progress = readJson(progressPath, { schema: 1, jurisdictions: {} }) ?? { schema: 1, jurisdictions: {} };
progress.jurisdictions ??= {};

function queueStats() {
  const rows = readJson(PATHS.seedTargets, []) ?? [];
  let pending = 0;
  let resolved = 0;
  let dropped = 0;
  for (const row of rows) {
    if (row?.status === "resolved") resolved += 1;
    else if (row?.status === "dropped") dropped += 1;
    else if (row?.waterbody && row?.state) pending += 1;
  }
  return { total: rows.length, pending, resolved, dropped };
}

const catalog = readCatalog();
const counts = new Map();
for (const record of catalog) {
  if (!record?.state) continue;
  counts.set(record.state, (counts.get(record.state) ?? 0) + 1);
}

const cooldownCutoff = Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000;
let priorities = [...counts.entries()]
  .map(([state, records]) => {
    const prior = progress.jurisdictions[state] ?? {};
    const scannedAt = Date.parse(prior.lastScannedAt ?? "") || 0;
    return {
      state,
      records,
      lastScannedAt: prior.lastScannedAt ?? null,
      lastYield: Number(prior.lastYield ?? 0),
      zeroYieldStreak: Number(prior.zeroYieldStreak ?? 0),
      cooling: !IGNORE_COOLDOWN && !ONLY_STATE && scannedAt >= cooldownCutoff,
      scannedAt,
    };
  })
  // First: jurisdictions not scanned recently. Within that pool, least-covered
  // still wins. A recent zero-yield state therefore cannot monopolize every run.
  .sort((a, b) =>
    Number(a.cooling) - Number(b.cooling) ||
    a.records - b.records ||
    a.scannedAt - b.scannedAt ||
    a.state.localeCompare(b.state),
  );

if (ONLY_STATE) priorities = priorities.filter((row) => row.state === ONLY_STATE);
priorities = priorities.slice(0, MAX_JURISDICTIONS);

if (!priorities.length) {
  console.error(`balanced-discover: no catalog jurisdiction matched ${ONLY_STATE ?? "the request"}`);
  process.exit(1);
}

const beforeQueue = queueStats();
let pendingNow = beforeQueue.pending;
let queuedThisRun = 0;
const rows = [];

console.log(`balanced-discover: catalog ${catalog.length} waters across ${counts.size} jurisdictions`);
console.log(`balanced-discover: target ${TARGET} new questions, max ${PER_STATE} per jurisdiction`);
console.log(`balanced-discover: ${beforeQueue.pending} unresolved question(s) already queued`);
console.log("");
console.log("Least-covered jurisdictions not scanned recently are asked first:");
for (const row of priorities.slice(0, 12)) {
  console.log(`  ${String(row.records).padStart(4)}  ${row.state}${row.cooling ? "  (cooldown fallback)" : ""}`);
}
console.log("");

for (const row of priorities) {
  if (queuedThisRun >= TARGET) break;

  const remaining = TARGET - queuedThisRun;
  const limit = Math.min(PER_STATE, remaining);
  const childArgs = [
    discoverPath,
    `--state=${row.state}`,
    `--limit=${limit}`,
    `--per-host=${Math.min(PER_HOST, limit)}`,
    `--max-hosts=${MAX_HOSTS}`,
    `--concurrency=${CONCURRENCY}`,
  ];
  if (DRY) childArgs.push("--dry");

  console.log("================================================================");
  console.log(` ${row.state}: ${row.records} catalog record(s); asking for up to ${limit} new candidate(s)`);
  console.log("================================================================");

  const result = spawnSync(process.execPath, childArgs, {
    stdio: "inherit",
    env: process.env,
  });

  const after = DRY ? { ...queueStats(), pending: pendingNow } : queueStats();
  const delta = DRY ? 0 : Math.max(0, after.pending - pendingNow);
  pendingNow = after.pending;
  queuedThisRun += delta;

  rows.push({
    state: row.state,
    existing: row.records,
    queued: delta,
    exitCode: result.status ?? 1,
  });

  if (!DRY) {
    const prior = progress.jurisdictions[row.state] ?? {};
    progress.jurisdictions[row.state] = {
      lastScannedAt: new Date().toISOString(),
      lastYield: delta,
      zeroYieldStreak: delta > 0 ? 0 : Number(prior.zeroYieldStreak ?? 0) + 1,
    };
    progress.updatedAt = new Date().toISOString();
    writeJson(progressPath, progress);
  }

  if ((result.status ?? 1) !== 0) {
    console.error(`balanced-discover: ${row.state} discovery exited ${result.status}; continuing to the next jurisdiction`);
  } else if (!DRY) {
    console.log(`balanced-discover: ${row.state} added ${delta} unresolved candidate(s); run total ${queuedThisRun}/${TARGET}`);
  }
  console.log("");
}

const afterQueue = queueStats();
const failed = rows.filter((row) => row.exitCode !== 0);
const noYield = rows.filter((row) => row.exitCode === 0 && row.queued === 0);

console.log("================================================================");
console.log(`balanced-discover: ${queuedThisRun} new candidate(s) queued from ${rows.length} jurisdiction(s)`);
console.log(`balanced-discover: ${afterQueue.pending} unresolved candidate(s) now waiting for resolve-targets.mjs`);
if (failed.length) console.log(`balanced-discover: ${failed.length} jurisdiction scan(s) returned an error; see report`);
console.log("================================================================");

const reportPath = writeReport("balanced-discovery", [
  `# Balanced discovery ${new Date().toISOString()}`,
  "",
  `Catalog records:           ${catalog.length}`,
  `Jurisdictions considered:  ${rows.length}`,
  `Requested new candidates:  ${TARGET}`,
  `Queued this run:           ${queuedThisRun}`,
  `Pending before:            ${beforeQueue.pending}`,
  `Pending after:             ${afterQueue.pending}`,
  `Dry run:                   ${DRY ? "yes" : "no"}`,
  `Cooldown hours:             ${COOLDOWN_HOURS}`,
  "",
  "Jurisdictions are processed from the smallest catalog count upward. This is",
  "deliberate: discovery should broaden the map instead of reinforcing the",
  "states that already have the most records. Jurisdictions scanned within the",
  `last ${COOLDOWN_HOURS} hours are deprioritized so repeated manual runs rotate outward.`,
  "",
  "## Jurisdictions",
  "",
  ...rows.map((row) =>
    `- ${row.state}: ${row.existing} existing; ${row.queued} newly queued; exit ${row.exitCode}`,
  ),
  "",
  "## Zero-yield scans",
  "",
  ...(noYield.length ? noYield.map((row) => `- ${row.state}`) : ["- none"]),
  "",
  "## Scan errors",
  "",
  ...(failed.length ? failed.map((row) => `- ${row.state}: exit ${row.exitCode}`) : ["- none"]),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

appendRun("balanced-discovery", {
  catalog: catalog.length,
  jurisdictions: rows.length,
  target: TARGET,
  queued: queuedThisRun,
  pendingBefore: beforeQueue.pending,
  pendingAfter: afterQueue.pending,
  errors: failed.length,
  cooldownHours: COOLDOWN_HOURS,
  dry: DRY,
});

if (failed.length === rows.length) process.exit(1);
