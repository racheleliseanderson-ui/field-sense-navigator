#!/usr/bin/env node
/**
 * Move proved records from the staging file into the catalog.
 *
 * This is the only script in the pipeline that writes src/data, and it is
 * deliberately dull: it assigns ids, refuses duplicates, appends, and stops.
 * All the judgement happened in resolve-targets.mjs, where a page was read.
 * Nothing is invented here and nothing is edited here -- a record that needs
 * a field this pipeline could not prove keeps that field null so a human can
 * see the gap.
 *
 * Existing records are never modified by this script. Growth is append-only;
 * refresh.mjs is what changes what is already held.
 *
 *   node scripts/pipeline/seed-destinations.mjs
 *   node scripts/pipeline/seed-destinations.mjs --dry
 */
import {
  PATHS,
  readCatalogSources,
  readJson,
  writeJson,
  waterKey,
  argv,
  ok,
  drop,
  note,
  writeReport,
  appendRun,
} from "./lib.mjs";

const args = argv();
const DRY = Boolean(args.dry);

// Ids and duplicates are checked against base AND shards; new records are
// appended to the base file, which is where growth belongs until a
// jurisdiction is large enough to shard.
const sources = readCatalogSources();
const base = sources[0].records;
const catalog = sources.flatMap((s) => s.records);
const staged = readJson(PATHS.stagedSeeds, []) ?? [];

if (!staged.length) {
  console.log("seed: nothing staged. Run resolve-targets.mjs first.");
  process.exit(0);
}

const knownKeys = new Set(catalog.map((r) => waterKey(r.waterbody, r.state)));
const knownUrls = new Set(
  catalog.map((r) =>
    String(r.officialSourceUrl ?? "")
      .replace(/\/$/, "")
      .toLowerCase(),
  ),
);

/** ids are HHI-DEST-###, zero padded to the width already in use. */
const width = Math.max(
  3,
  ...catalog.map(
    (r) =>
      String(r.id ?? "")
        .split("-")
        .pop()?.length ?? 3,
  ),
);
let next = Math.max(0, ...catalog.map((r) => Number(String(r.id ?? "").replace(/\D/g, "")) || 0));
const nextId = () => {
  next += 1;
  return `HHI-DEST-${String(next).padStart(width, "0")}`;
};

const added = [];
const refused = [];

for (const record of staged) {
  const key = waterKey(record.waterbody, record.state);
  const url = String(record.officialSourceUrl ?? "")
    .replace(/\/$/, "")
    .toLowerCase();

  if (!record.waterbody || !record.state || !record.waterType || !record.officialSourceUrl) {
    refused.push({ record, reason: "missing_required_field" });
    drop(`${record.waterbody ?? "(unnamed)"} — missing a required field`);
    continue;
  }
  if (knownKeys.has(key)) {
    refused.push({ record, reason: "already_in_catalog" });
    drop(`${record.waterbody} (${record.state}) — already in the catalog`);
    continue;
  }
  if (knownUrls.has(url)) {
    refused.push({ record, reason: "source_url_already_in_catalog" });
    drop(`${record.waterbody} (${record.state}) — that official page is already cited`);
    continue;
  }

  knownKeys.add(key);
  knownUrls.add(url);
  const withId = { ...record, id: nextId() };
  added.push(withId);
  ok(`${withId.id}  ${withId.waterbody} (${withId.state}, ${withId.waterType})`);
}

console.log("");
console.log(`seed: ${added.length} added, ${refused.length} refused`);

const needsAgency = added.filter((r) => !r.managingAgency).length;
const needsAccess = added.filter((r) => !r.publicAccess?.length).length;

const reportPath = writeReport("seed", [
  `# Seed run ${new Date().toISOString()}`,
  "",
  `Catalog before: ${catalog.length}`,
  `Added:          ${added.length}`,
  `Refused:        ${refused.length}`,
  `Catalog after:  ${catalog.length + (DRY ? 0 : added.length)}`,
  "",
  "Every record below was verified against an official page by",
  "resolve-targets.mjs. None has been read by a person: lastHumanReviewedAt is",
  "null on all of them and nextReviewAt is set 30 days out, which is what puts",
  "them in front of a reviewer rather than quietly into production wording.",
  "",
  "## Needs a human",
  "",
  `- ${needsAgency} of ${added.length} have no managing agency the catalog could infer`,
  `- ${needsAccess} of ${added.length} have no published access the page stated`,
  `- ${added.filter((r) => !r.speciesContext?.length).length} of ${added.length} have no species named on the page`,
  `- ${added.filter((r) => !r.region).length} of ${added.length} have no region`,
  "",
  "## Added",
  "",
  ...added.map(
    (r) => `- ${r.id} — ${r.waterbody} (${r.state}, ${r.waterType}) — ${r.officialSourceUrl}`,
  ),
  "",
  "## Refused",
  "",
  ...refused.map((r) => `- ${r.record.waterbody} (${r.record.state}) — ${r.reason}`),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (DRY) {
  console.log("seed: --dry, destinations.json not written");
} else if (added.length) {
  writeJson(PATHS.destinations, [...base, ...added]);
  writeJson(PATHS.stagedSeeds, []);
  console.log(
    `seed: the catalog now holds ${catalog.length + added.length} records (${base.length + added.length} in destinations.json)`,
  );
} else {
  console.log("seed: nothing to add");
}

appendRun("seed", {
  before: catalog.length,
  added: added.length,
  refused: refused.length,
  dry: DRY,
});
