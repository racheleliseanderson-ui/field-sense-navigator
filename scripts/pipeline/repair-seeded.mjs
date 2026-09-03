#!/usr/bin/env node
/**
 * Repair records a previous seeding run added before the gates were tight
 * enough.
 *
 * Two defects are corrected, both of them mine:
 *
 * WRONG JURISDICTION. A federal host (blm.gov, nps.gov, fs.usda.gov) publishes
 * in every state. The first version of the resolver treated "this host's few
 * existing records all happen to be Idaho" as evidence the host serves Idaho,
 * so rivers in California, Oregon and Arizona entered the catalog as Idaho
 * waters. A record whose jurisdiction was assigned that way cannot be
 * corrected here -- the state was never read from anything -- so it is
 * removed. The water is not gone; it can be discovered again properly.
 *
 * A MANAGEMENT UNIT IS NOT A WATER. "Dowdy Lake SWA" is a State Wildlife Area
 * on Dowdy Lake. Filed under the unit name it is a record no angler searches
 * for and a near-duplicate of the lake. The designation is stripped and the
 * water class recomputed from the corrected name. Where the corrected name
 * collides with a record the catalog already holds, the older record wins and
 * the seeded one is removed.
 *
 * Names that are a document, a road or a landform ("Lake Simcoe Protection
 * Plan", "Colorado River Headwaters Byway") are removed outright.
 *
 * Scope is limited to records at or above --from-id, so nothing a person wrote
 * can be touched. Offline; reads no pages.
 *
 *   node scripts/pipeline/repair-seeded.mjs --from-id=524 --dry
 *   node scripts/pipeline/repair-seeded.mjs --from-id=524
 */
import {
  PATHS, readCatalogSources, writeJson, hostOf, isMultiStateHost, waterKey,
  argv, ok, drop, note, writeReport, appendRun,
} from "./lib.mjs";
import { stripDesignation, refuseAsWaterbodyName, waterTypeFrom, tagsFrom } from "./extract.mjs";

const args = argv();
const DRY = Boolean(args.dry);
const FROM = Number(args["from-id"]);

if (!Number.isFinite(FROM)) {
  console.error("repair: --from-id is required, e.g. --from-id=524");
  console.error("        It is the lowest id this run may touch. Records below it are");
  console.error("        left alone, which is what keeps human-written records safe.");
  process.exit(1);
}

const idNum = (record) => Number(String(record.id ?? "").replace(/\D/g, "")) || 0;

const sources = readCatalogSources();
const catalog = sources.flatMap((s) => s.records);
const inScope = catalog.filter((r) => idNum(r) >= FROM);
const untouched = catalog.filter((r) => idNum(r) < FROM);

console.log(`repair: ${inScope.length} seeded records in scope (ids >= ${FROM}); ${untouched.length} left alone`);

/* Names already held, so a corrected name cannot create a duplicate. */
const heldKeys = new Set(untouched.map((r) => waterKey(r.waterbody, r.state)));

const verdicts = new Map();
const removed = [];
const renamed = [];

for (const record of inScope) {
  const host = hostOf(record.officialSourceUrl);

  if (isMultiStateHost(host)) {
    verdicts.set(record.id, null);
    removed.push({ record, reason: `jurisdiction_never_evidenced (${host} serves every state)` });
    continue;
  }

  const corrected = stripDesignation(record.waterbody);

  const refusal = refuseAsWaterbodyName(corrected) ?? refuseAsWaterbodyName(record.waterbody);
  if (refusal) {
    verdicts.set(record.id, null);
    removed.push({ record, reason: `name_refused (${refusal})` });
    continue;
  }

  const waterType = waterTypeFrom(corrected);
  if (!waterType) {
    verdicts.set(record.id, null);
    removed.push({ record, reason: "corrected_name_declares_no_water_class" });
    continue;
  }

  const key = waterKey(corrected, record.state);
  if (heldKeys.has(key)) {
    verdicts.set(record.id, null);
    removed.push({ record, reason: `duplicate_of_a_record_already_held (${corrected})` });
    continue;
  }
  heldKeys.add(key);

  if (corrected === record.waterbody && waterType === record.waterType) {
    verdicts.set(record.id, record);
    continue;
  }

  const fixed = {
    ...record,
    waterbody: corrected,
    waterType,
    tags: tagsFrom(waterType, record.publicAccess ?? [], (record.currentNotices ?? []).join(" ")),
  };
  verdicts.set(record.id, fixed);
  renamed.push({ from: record.waterbody, to: corrected, id: record.id, was: record.waterType, now: waterType });
}

for (const r of renamed) ok(`${r.id}  ${r.from}  ->  ${r.to}${r.was !== r.now ? `  (${r.was} -> ${r.now})` : ""}`);
for (const r of removed) drop(`${r.record.id}  ${r.record.waterbody} (${r.record.state}) — ${r.reason}`);

const kept = inScope.length - removed.length;
console.log("");
console.log(`repair: ${kept} kept, ${renamed.length} renamed, ${removed.length} removed`);

const byReason = removed.reduce((acc, r) => {
  const kind = r.reason.split(" ")[0];
  return { ...acc, [kind]: (acc[kind] ?? 0) + 1 };
}, {});

const reportPath = writeReport("repair-seeded", [
  `# Repair of seeded records ${new Date().toISOString()}`,
  "",
  `Scope:    ids >= ${FROM} (${inScope.length} records)`,
  `Kept:     ${kept}`,
  `Renamed:  ${renamed.length}`,
  `Removed:  ${removed.length}`,
  "",
  "Records below the scope id were not read and not written.",
  "",
  "## Why records were removed",
  "",
  ...Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`),
  "",
  ...removed.map((r) => `- ${r.record.id} ${r.record.waterbody} (${r.record.state}) — ${r.reason}\n  ${r.record.officialSourceUrl}`),
  "",
  "## Renamed",
  "",
  ...(renamed.length
    ? renamed.map((r) => `- ${r.id} — "${r.from}" -> "${r.to}"${r.was !== r.now ? ` (${r.was} -> ${r.now})` : ""}`)
    : ["- none"]),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (DRY) {
  console.log("repair: --dry, nothing written");
} else {
  let files = 0;
  for (const source of sources) {
    if (!source.records.some((r) => idNum(r) >= FROM)) continue;
    const next = source.records.flatMap((r) => {
      if (idNum(r) < FROM) return [r];
      const verdict = verdicts.get(r.id);
      return verdict ? [verdict] : [];
    });
    writeJson(source.path, next);
    files += 1;
  }
  console.log(`repair: ${files} catalog file${files === 1 ? "" : "s"} rewritten`);
}

appendRun("repair-seeded", { from: FROM, scope: inScope.length, kept, renamed: renamed.length, removed: removed.length, dry: DRY });
