#!/usr/bin/env node
/**
 * Read-only answer to "what state is the catalog in, and what needs a person?"
 *
 * Changes nothing, writes nothing except a report. Everything it reports is
 * computed from files already in the repository, so it runs in a second and
 * works with no internet -- pass --links to also check that each official page
 * still loads, which is the only part that needs the network.
 *
 *   node scripts/pipeline/health.mjs
 *   node scripts/pipeline/health.mjs --links --batch=80
 */
import {
  PATHS,
  readCatalog,
  readJson,
  hostOf,
  trustTier,
  waterKey,
  plain,
  fetchPage,
  pooled,
  argv,
  writeReport,
  appendRun,
  today,
} from "./lib.mjs";

const args = argv();
const CHECK_LINKS = Boolean(args.links);
const BATCH = Number(args.batch) || 80;

const catalog = readCatalog();
const bindings = readJson(PATHS.stationBindings, { records: [] });
const bindingByid = new Map((bindings.records ?? []).map((b) => [b.destinationId, b]));

const now = Date.now();
const DAY = 86_400_000;
const ageDays = (value) => (value ? Math.floor((now - Date.parse(value)) / DAY) : null);

const line = (label, value) => `${label.padEnd(44)} ${value}`;
const pct = (n) => `${((n / Math.max(1, catalog.length)) * 100).toFixed(0)}%`;

/* ── 1. how old is the evidence ─────────────────────────────────────────── */
const buckets = {
  "under 30 days": 0,
  "30 to 90 days": 0,
  "90 to 180 days": 0,
  "over 180 days": 0,
  "never recorded": 0,
};
for (const r of catalog) {
  const age = ageDays(r.lastVerified ?? r.checkedAt);
  if (age === null || Number.isNaN(age)) buckets["never recorded"] += 1;
  else if (age < 30) buckets["under 30 days"] += 1;
  else if (age < 90) buckets["30 to 90 days"] += 1;
  else if (age < 180) buckets["90 to 180 days"] += 1;
  else buckets["over 180 days"] += 1;
}
const overdue = catalog.filter((r) => r.nextReviewAt && r.nextReviewAt < today());
const neverHumanReviewed = catalog.filter((r) => !r.lastHumanReviewedAt);

/* ── 2. duplicates ──────────────────────────────────────────────────────── */
const byWater = new Map();
const byUrl = new Map();
const byId = new Map();
for (const r of catalog) {
  const wk = waterKey(r.waterbody, r.state);
  byWater.set(wk, [...(byWater.get(wk) ?? []), r]);
  const url = String(r.officialSourceUrl ?? "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (url) byUrl.set(url, [...(byUrl.get(url) ?? []), r]);
  byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
}
const dupWaters = [...byWater.values()].filter((g) => g.length > 1);
const dupIds = [...byId.values()].filter((g) => g.length > 1);
// A shared official page is normal when an agency publishes one directory for
// many waters, so it is reported as a note rather than as a fault.
const sharedPages = [...byUrl.entries()]
  .filter(([, g]) => g.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

/* ── 3. what can it actually answer ─────────────────────────────────────── */
const has = (fn) => catalog.filter(fn).length;
const coverage = {
  "managing agency named": has((r) => Boolean(r.managingAgency)),
  "official regulations url": has((r) => Boolean(r.officialRegsUrl)),
  "at least one published access": has((r) => (r.publicAccess ?? []).length > 0),
  "at least one current notice": has((r) => (r.currentNotices ?? []).length > 0),
  "species context": has((r) => (r.speciesContext ?? []).length > 0),
  "region named": has((r) => Boolean(r.region)),
  "gauge or tide station bound": has((r) => bindingByid.get(r.id)?.status === "matched"),
  "weather station bound": has((r) => Boolean(bindingByid.get(r.id)?.nwsStationId)),
  "human reviewed at least once": has((r) => Boolean(r.lastHumanReviewedAt)),
};

/* ── 4. sources we should not be trusting ───────────────────────────────── */
const untrusted = catalog.filter((r) => trustTier(r.officialSourceUrl) === "untrusted");
const byTier = catalog.reduce((acc, r) => {
  const tier = trustTier(r.officialSourceUrl);
  return { ...acc, [tier]: (acc[tier] ?? 0) + 1 };
}, {});

/* ── 5. shape ───────────────────────────────────────────────────────────── */
const byState = [
  ...catalog.reduce((m, r) => m.set(r.state, (m.get(r.state) ?? 0) + 1), new Map()),
].sort((a, b) => b[1] - a[1]);
const byType = [
  ...catalog.reduce((m, r) => m.set(r.waterType, (m.get(r.waterType) ?? 0) + 1), new Map()),
].sort((a, b) => b[1] - a[1]);
const queued = (readJson(PATHS.seedTargets, []) ?? []).filter((t) => t.status === "queued").length;
const staged = (readJson(PATHS.stagedSeeds, []) ?? []).length;

/* ── 6. optional link check ─────────────────────────────────────────────── */
let deadLinks = [];
if (CHECK_LINKS) {
  const oldest = [...catalog]
    .sort((a, b) => (Date.parse(a.lastVerified ?? 0) || 0) - (Date.parse(b.lastVerified ?? 0) || 0))
    .slice(0, BATCH);
  console.log(`checking ${oldest.length} official pages...`);
  const results = await pooled(oldest, 4, async (r) => {
    const page = await fetchPage(r.officialSourceUrl, { timeoutMs: 12_000, retries: 0 });
    return page.ok ? null : { record: r, reason: page.reason };
  });
  deadLinks = results.filter(Boolean);
}

/* ── report ─────────────────────────────────────────────────────────────── */
const out = [];
const say = (s = "") => {
  out.push(s);
  console.log(s);
};

say("");
say("  HOW OLD IS THE INFORMATION?");
say("  " + "-".repeat(66));
for (const [label, n] of Object.entries(buckets)) say("  " + line(label, `${n} records`));
say("  " + line("past their own review date", `${overdue.length} records`));
say("  " + line("never read by a person", `${neverHumanReviewed.length} records`));
say("");

say("  ANY DUPLICATES?");
say("  " + "-".repeat(66));
say("  " + line("same water, same jurisdiction, twice", `${dupWaters.length}`));
say("  " + line("duplicate record ids", `${dupIds.length}`));
say(
  "  " +
    line("official pages cited by 2+ records", `${sharedPages.length} (normal for directories)`),
);
for (const g of dupWaters.slice(0, 10)) {
  say(`    ${g.map((r) => r.id).join(" / ")}  ${g[0].waterbody} (${g[0].state})`);
}
say("");

say("  WHAT CAN THE CATALOGUE ANSWER?");
say("  " + "-".repeat(66));
for (const [label, n] of Object.entries(coverage))
  say("  " + line(label, `${n} of ${catalog.length}  (${pct(n)})`));
say("");

say("  WHERE IS IT READING FROM?");
say("  " + "-".repeat(66));
for (const [tier, n] of Object.entries(byTier)) say("  " + line(tier, `${n} records`));
if (untrusted.length) {
  say("  sources that are neither an agency nor a named authority:");
  for (const r of untrusted.slice(0, 20))
    say(`    ${r.id}  ${r.waterbody} (${r.state}) — ${hostOf(r.officialSourceUrl)}`);
}
say("");

say("  SHAPE");
say("  " + "-".repeat(66));
say("  " + line("records", String(catalog.length)));
say("  " + line("jurisdictions", String(byState.length)));
say("  " + line("water classes", byType.map(([t, n]) => `${t} ${n}`).join(", ")));
say("  " + line("targets queued for seeding", String(queued)));
say("  " + line("records staged, not yet seeded", String(staged)));
if (CHECK_LINKS) {
  say("  " + line("official pages checked", String(Math.min(BATCH, catalog.length))));
  say("  " + line("pages that did not load", String(deadLinks.length)));
  for (const d of deadLinks.slice(0, 25))
    say(`    ${d.record.id}  ${d.record.waterbody} — ${d.reason}`);
}
say("");

const reportPath = writeReport("health", [
  `# Health check ${new Date().toISOString()}`,
  "",
  "Read-only. Nothing in the catalog was changed by this run.",
  "",
  "## Age of the evidence",
  "",
  ...Object.entries(buckets).map(([k, v]) => `- ${k}: ${v}`),
  `- past their own review date: ${overdue.length}`,
  `- never read by a person: ${neverHumanReviewed.length}`,
  "",
  "## Coverage",
  "",
  ...Object.entries(coverage).map(([k, v]) => `- ${k}: ${v} of ${catalog.length} (${pct(v)})`),
  "",
  "## Duplicates",
  "",
  ...(dupWaters.length
    ? dupWaters.map(
        (g) => `- ${g.map((r) => r.id).join(" / ")} — ${g[0].waterbody} (${g[0].state})`,
      )
    : ["- none"]),
  "",
  "## Sources that are neither an agency nor a named authority",
  "",
  ...(untrusted.length
    ? untrusted.map((r) => `- ${r.id} ${r.waterbody} (${r.state}) — ${r.officialSourceUrl}`)
    : ["- none"]),
  "",
  "## Records past their review date",
  "",
  ...overdue
    .slice(0, 200)
    .map((r) => `- ${r.id} ${r.waterbody} (${r.state}) — due ${r.nextReviewAt}`),
  ...(overdue.length > 200 ? [`- ...and ${overdue.length - 200} more`] : []),
  "",
  "## Jurisdictions",
  "",
  ...byState.map(([state, n]) => `- ${state}: ${n}`),
  ...(CHECK_LINKS
    ? [
        "",
        "## Official pages that did not load",
        "",
        ...(deadLinks.length
          ? deadLinks.map(
              (d) =>
                `- ${d.record.id} ${d.record.waterbody} — ${d.reason} — ${d.record.officialSourceUrl}`,
            )
          : ["- none"]),
      ]
    : []),
]);
console.log(`  report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);
console.log("");

appendRun("health", {
  records: catalog.length,
  overdue: overdue.length,
  duplicates: dupWaters.length,
  untrusted: untrusted.length,
  deadLinks: deadLinks.length,
  links: CHECK_LINKS,
});
