#!/usr/bin/env node
/**
 * Re-read the official page behind every record and bring what it says up to
 * date.
 *
 * Three rules shape everything here.
 *
 * ADDITIVE BY DEFAULT. An agency notice a person wrote into this catalog is
 * evidence that a person read the page. This script may add wording the page
 * now carries; it does not delete wording it merely failed to find, because
 * "I could not find it" and "it is gone" are different claims and only one of
 * them is true. `--prune-notices` opts into removal for a reviewer who wants
 * it, and says so in the report.
 *
 * A DEAD LINK IS NOT A DEAD WATER. A record whose page 404s keeps every field
 * it has, keeps its old review dates, and is listed in the report for a human.
 * Silently retiring a named public water because a state redesigned its site
 * is the failure mode this catalog exists to avoid.
 *
 * DATES FOLLOW EVIDENCE. lastVerified and the reviewed dates move only for
 * records whose page was actually read and still names the water. A record
 * that failed today keeps yesterday's dates and stays visibly stale.
 *
 * Needs the internet.
 *
 *   node scripts/pipeline/refresh.mjs --batch=60
 *   node scripts/pipeline/refresh.mjs --state=Montana
 *   node scripts/pipeline/refresh.mjs --all --concurrency=4
 *   node scripts/pipeline/refresh.mjs --batch=20 --dry
 */
import {
  PATHS,
  readCatalogSources,
  writeJson,
  hostOf,
  trustTier,
  plain,
  fetchPage,
  robotsAllows,
  pooled,
  argv,
  ok,
  drop,
  note,
  writeReport,
  appendRun,
  today,
  addDays,
  pageCarriesPhrase,
  pageNamesWater,
  sleep,
  mainText,
} from "./lib.mjs";
import { agencyIndex } from "./agencies.mjs";
import { accessFrom, noticesFrom, speciesFrom } from "./extract.mjs";

const args = argv();
const DRY = Boolean(args.dry);
const ALL = Boolean(args.all);
const BATCH = Number(args.batch) || (ALL ? Infinity : 60);
const ONLY_STATE = args.state ? plain(args.state) : null;
const CONCURRENCY = Math.max(1, Math.min(6, Number(args.concurrency ?? 4)));
const DELAY_MS = Number(args.delay ?? 250);
const PRUNE = Boolean(args["prune-notices"]);
const REVIEW_DAYS = Number(args["review-days"]) || 180;

const MAX_NOTICES = 8;
const MAX_ACCESS = 10;
const MAX_SPECIES = 12;

// A record may live in the base file or in a jurisdiction shard, and it has to
// be written back to the file it came from -- collapsing shards into the base
// file would silently duplicate every id the next time assert-catalog runs.
const sources = readCatalogSources();
const catalog = sources.flatMap((s) => s.records);
const index = agencyIndex();

/* oldest evidence first -- that is where a refresh buys the most */
const ageOf = (r) => Date.parse(r.lastVerified ?? r.checkedAt ?? "1970-01-01") || 0;
let queue = catalog.filter((r) => r.officialSourceUrl);
if (ONLY_STATE) queue = queue.filter((r) => plain(r.state) === ONLY_STATE);
queue = [...queue]
  .sort((a, b) => ageOf(a) - ageOf(b))
  .slice(0, BATCH === Infinity ? undefined : BATCH);

console.log(
  `refresh: ${queue.length} of ${catalog.length} records, oldest evidence first` +
    `${PRUNE ? " (pruning notices)" : ""}${DRY ? " (dry run)" : ""}`,
);

const norm = (s) =>
  plain(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const mergeStrings = (existing, found, cap) => {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map((s) => norm(s).slice(0, 60)));
  let addedCount = 0;
  for (const item of found) {
    if (out.length >= cap) break;
    const key = norm(item).slice(0, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    addedCount += 1;
  }
  return { list: out, added: addedCount };
};

const updates = new Map();
const issues = [];
const changeLog = [];

await pooled(queue, CONCURRENCY, async (record) => {
  const url = record.officialSourceUrl;

  if (trustTier(url) === "untrusted") {
    issues.push({ record, kind: "untrusted_source_host", detail: hostOf(url) });
    drop(`${record.waterbody} (${record.state}) — source host is not an agency or authority`);
    return;
  }
  if (!(await robotsAllows(url))) {
    issues.push({ record, kind: "robots_disallow", detail: hostOf(url) });
    drop(`${record.waterbody} — robots.txt disallows this page`);
    return;
  }

  const page = await fetchPage(url);
  if (DELAY_MS) await sleep(DELAY_MS);

  if (!page.ok) {
    issues.push({ record, kind: "page_unreadable", detail: page.reason });
    drop(`${record.waterbody} (${record.state}) — ${page.reason} — record kept, dates unchanged`);
    return;
  }
  if (trustTier(page.url) === "untrusted") {
    issues.push({ record, kind: "redirects_off_agency", detail: hostOf(page.url) });
    drop(`${record.waterbody} — now redirects to ${hostOf(page.url)}`);
    return;
  }

  const stillNamed =
    pageCarriesPhrase(page.text, record.waterbody) ||
    pageNamesWater(page.text, record.waterbody, { title: page.title });
  if (!stillNamed) {
    issues.push({ record, kind: "page_no_longer_names_water", detail: page.url });
    drop(
      `${record.waterbody} — that page no longer names this water — record kept, dates unchanged`,
    );
    return;
  }

  /* ── what the page says today ─────────────────────────────────────── */
  const body = mainText(page.html, page.text);
  const foundNotices = noticesFrom(body);
  const foundAccess = accessFrom(body, record.waterbody);
  const foundSpecies = speciesFrom(body, index.speciesVocabulary);

  const notices = PRUNE
    ? (() => {
        const kept = (record.currentNotices ?? []).filter((n) =>
          foundNotices.some((f) => norm(f).slice(0, 60) === norm(n).slice(0, 60)),
        );
        return mergeStrings(kept, foundNotices, MAX_NOTICES);
      })()
    : mergeStrings(record.currentNotices, foundNotices, MAX_NOTICES);

  const species = mergeStrings(record.speciesContext, foundSpecies, MAX_SPECIES);

  const accessSeen = new Set((record.publicAccess ?? []).map((a) => norm(a.name)));
  const newAccess = foundAccess.filter((a) => !accessSeen.has(norm(a.name)));
  const publicAccess = [...(record.publicAccess ?? []), ...newAccess].slice(0, MAX_ACCESS);

  const changes = [];
  if (notices.added) changes.push(`+${notices.added} notice${notices.added === 1 ? "" : "s"}`);
  if (PRUNE) {
    const removed = (record.currentNotices ?? []).length + notices.added - notices.list.length;
    if (removed > 0) changes.push(`-${removed} notice${removed === 1 ? "" : "s"}`);
  }
  if (newAccess.length) changes.push(`+${newAccess.length} access`);
  if (species.added) changes.push(`+${species.added} species`);

  const agency = record.managingAgency ?? index.agencyFor(page.url);
  const regs = record.officialRegsUrl ?? index.regsFor(page.url);
  if (!record.managingAgency && agency) changes.push("agency filled");
  if (!record.officialRegsUrl && regs) changes.push("regs url filled");
  if (page.url.replace(/\/$/, "") !== url.replace(/\/$/, ""))
    changes.push("source url followed a redirect");

  updates.set(record.id, {
    ...record,
    officialSourceUrl: page.url,
    checkedAt: new Date().toISOString(),
    nextReviewAt: addDays(REVIEW_DAYS),
    currentNotices: notices.list,
    publicAccess,
    speciesContext: species.list,
    managingAgency: agency,
    officialRegsUrl: regs,
    regsReviewedDate: today(),
    accessReviewedDate: today(),
    lastVerified: today(),
  });

  if (changes.length) changeLog.push({ record, changes });
  ok(
    `${record.waterbody} (${record.state})${changes.length ? ` — ${changes.join(", ")}` : " — unchanged, re-verified"}`,
  );
});

const refreshed = updates.size;
console.log("");
console.log(
  `refresh: ${refreshed} re-verified, ${issues.length} need a human, ${changeLog.length} changed`,
);

const byKind = issues.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
const reportPath = writeReport("refresh", [
  `# Refresh run ${new Date().toISOString()}`,
  "",
  `Records attempted:  ${queue.length}`,
  `Re-verified:        ${refreshed}`,
  `Changed:            ${changeLog.length}`,
  `Need a human:       ${issues.length}`,
  `Notice pruning:     ${PRUNE ? "ON (wording the page no longer carries was removed)" : "off (additive only)"}`,
  "",
  'Records listed under "need a human" were NOT modified. They keep every',
  "field and every date they had, which is what makes them show as stale",
  "rather than quietly current.",
  "",
  "## Needs a human",
  "",
  ...Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `- ${kind}: ${n}`),
  "",
  ...issues.map(
    (i) =>
      `- ${i.record.id} ${i.record.waterbody} (${i.record.state}) — ${i.kind} — ${i.detail}\n  ${i.record.officialSourceUrl}`,
  ),
  "",
  "## What changed",
  "",
  ...(changeLog.length
    ? changeLog.map(
        (c) =>
          `- ${c.record.id} ${c.record.waterbody} (${c.record.state}) — ${c.changes.join(", ")}`,
      )
    : ["- nothing; every page read matched what the catalog already held"]),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (DRY) {
  console.log("refresh: --dry, destinations.json not written");
} else if (refreshed) {
  let filesWritten = 0;
  for (const source of sources) {
    if (!source.records.some((r) => updates.has(r.id))) continue;
    writeJson(
      source.path,
      source.records.map((r) => updates.get(r.id) ?? r),
    );
    filesWritten += 1;
  }
  console.log(
    `refresh: ${filesWritten} catalog file${filesWritten === 1 ? "" : "s"} rewritten ` +
      `(${catalog.length} records, order unchanged)`,
  );
}

appendRun("refresh", {
  attempted: queue.length,
  refreshed,
  changed: changeLog.length,
  issues: byKind,
  prune: PRUNE,
  dry: DRY,
});
