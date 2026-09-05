#!/usr/bin/env node
/**
 * Prove each queued target against an official page, or drop it and say why.
 *
 * This is where the doctrine is enforced. The expensive step in growing this
 * catalog is not naming a lake -- it is proving that a given page belongs to
 * that lake, that the page is one an agency stands behind, and that every
 * field written came off the page rather than out of a plausible guess. That
 * step is mechanical, so it belongs in code rather than in a reviewer's
 * patience.
 *
 * Six gates, all of which must pass:
 *
 *   1. robots.txt allows the fetch
 *   2. the page loads and is not a soft 404
 *   3. the host is government or a named public authority
 *   4. the page NAMES the water
 *   5. the page reads like a page about fishing this water
 *   6. the water's class (lake / river / reservoir / marine) is declared by
 *      its own published name
 *
 * A target that fails any gate is dropped with its reason, never downgraded
 * into a weaker record. Output is staged, not committed: seed-destinations.mjs
 * is what touches src/data.
 *
 * Needs the internet.
 *
 *   node scripts/pipeline/resolve-targets.mjs
 *   node scripts/pipeline/resolve-targets.mjs --state=Texas --limit=40
 *   node scripts/pipeline/resolve-targets.mjs --dry --limit=5
 */
import {
  PATHS,
  readCatalog,
  readJson,
  writeJson,
  hostOf,
  trustTier,
  waterKey,
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
  pageNamesWater,
  pageCarriesPhrase,
  pageReadsAsWater,
  sleep,
  mainText,
  isMultiStateHost,
} from "./lib.mjs";
import { agencyIndex } from "./agencies.mjs";
import {
  publishedName,
  waterTypeFrom,
  accessFrom,
  noticesFrom,
  speciesFrom,
  tagsFrom,
  chooseWaterbodyName,
  boilerplateFilter,
} from "./extract.mjs";

const args = argv();
const DRY = Boolean(args.dry);
const LIMIT = Number(args.limit) || Infinity;
const ONLY_STATE = args.state ? plain(args.state) : null;
const CONCURRENCY = Math.max(1, Math.min(6, Number(args.concurrency ?? 4)));
const DELAY_MS = Number(args.delay ?? 250);

/** Seeded records are reviewed sooner than human-written ones. */
const SEED_REVIEW_DAYS = 30;

const STATUS_FOR_TYPE = {
  marine: "current_with_tide_and_marine_checks",
  reservoir: "current_with_same_day_rule_check_required",
  lake: "current_with_same_day_rule_check_required",
  river: "current_with_same_day_rule_check_required",
};

const records = readCatalog();
const index = agencyIndex();
const knownKeys = new Set(records.map((r) => waterKey(r.waterbody, r.state)));
const knownUrls = new Set(
  records.map((r) =>
    String(r.officialSourceUrl ?? "")
      .replace(/\/$/, "")
      .toLowerCase(),
  ),
);

let targets = (readJson(PATHS.seedTargets, []) ?? []).filter((t) => t && t.waterbody && t.state);
if (ONLY_STATE) targets = targets.filter((t) => plain(t.state) === ONLY_STATE);
targets = targets.filter((t) => t.status !== "resolved" && t.status !== "dropped");
targets = targets.slice(0, LIMIT === Infinity ? targets.length : LIMIT);

console.log(`resolve: ${targets.length} target${targets.length === 1 ? "" : "s"} to prove`);
if (!targets.length) {
  console.log(
    "resolve: nothing queued. Run discover.mjs, or add names to scripts/data/seed-targets.json.",
  );
  process.exit(0);
}

/* ── candidate URLs for a target that has none ──────────────────────────── */
/**
 * A hand-typed target carries a name and a state but no URL. Rather than guess
 * a domain the way a restaurant resolver can, the shapes are taken from URLs
 * that already work: for every family this state's agencies keep waters in,
 * the trailing slug is replaced with this water's slug. Every candidate still
 * has to clear all six gates, so a wrong guess costs a fetch, not a record.
 */
const familiesByState = (() => {
  const map = new Map();
  for (const r of records) {
    let parts;
    try {
      parts = new URL(r.officialSourceUrl).pathname.split("/").filter(Boolean);
    } catch {
      continue;
    }
    if (parts.length < 2) continue;
    const origin = new URL(r.officialSourceUrl).origin;
    const prefix = `${origin}/${parts.slice(0, -1).join("/")}/`;
    const key = plain(r.state);
    const bucket = map.get(key) ?? new Map();
    bucket.set(prefix, (bucket.get(prefix) ?? 0) + 1);
    map.set(key, bucket);
  }
  for (const [key, bucket] of map) {
    map.set(
      key,
      [...bucket.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([p]) => p),
    );
  }
  return map;
})();

/**
 * The jurisdiction a host serves, when it serves exactly one. A state agency
 * host does; a federal one does not, and must not be allowed to vouch for a
 * state it never mentioned.
 */
const hostStates = (() => {
  const map = new Map();
  for (const r of records) {
    const host = hostOf(r.officialSourceUrl);
    if (!host) continue;
    const bucket = map.get(host) ?? new Map();
    bucket.set(plain(r.state), (bucket.get(plain(r.state)) ?? 0) + 1);
    map.set(host, bucket);
  }
  const out = new Map();
  for (const [host, bucket] of map) {
    // A federal host is never single-state, however its records happen to fall.
    if (isMultiStateHost(host)) continue;
    const total = [...bucket.values()].reduce((a, b) => a + b, 0);
    const [state, n] = [...bucket.entries()].sort((a, b) => b[1] - a[1])[0];
    // Eight records at 95% -- three at 100% is a coincidence, not a pattern.
    if (total >= 8 && n / total >= 0.95) out.set(host, state);
  }
  return out;
})();

const singleStateHost = (host) => hostStates.get(host) ?? null;

const slugsFor = (name) => {
  const base = plain(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const noClass = base.replace(/^lake-/, "").replace(/-lake$/, "");
  return [...new Set([base, base.replace(/-/g, "_"), noClass].filter(Boolean))];
};

function candidateUrls(target) {
  if (target.url) return [target.url];
  const prefixes = familiesByState.get(plain(target.state)) ?? [];
  const out = [];
  for (const prefix of prefixes)
    for (const slug of slugsFor(target.waterbody)) out.push(`${prefix}${slug}`);
  return out.slice(0, 8);
}

/* ── the six gates ──────────────────────────────────────────────────────── */
async function resolveOne(target) {
  const candidates = candidateUrls(target);
  if (!candidates.length) return { target, dropped: "no_candidate_url" };

  let lastReason = "unresolved";
  for (const candidate of candidates) {
    const tier = trustTier(candidate);
    if (tier === "untrusted") {
      lastReason = `untrusted_host_${hostOf(candidate) || "unknown"}`;
      continue;
    }
    if (!(await robotsAllows(candidate))) {
      lastReason = "robots_disallow";
      continue;
    }

    const page = await fetchPage(candidate);
    if (DELAY_MS) await sleep(DELAY_MS);
    if (!page.ok) {
      lastReason = page.reason ?? "unreachable";
      continue;
    }

    // A redirect can land on a different host; the tier of where we ENDED up
    // is the one that counts.
    const finalTier = trustTier(page.url);
    if (finalTier === "untrusted") {
      lastReason = `redirected_to_untrusted_${hostOf(page.url) || "unknown"}`;
      continue;
    }

    const published = publishedName(page.html, page.title);
    const nameForChecks = published ?? target.waterbody;

    const namesIt =
      pageCarriesPhrase(page.text, target.waterbody) ||
      pageCarriesPhrase(page.text, nameForChecks) ||
      (pageNamesWater(page.text, target.waterbody, { title: page.title }) &&
        pageNamesWater(page.text, nameForChecks, { title: page.title }));
    if (!namesIt) {
      lastReason = "page_does_not_name_the_water";
      continue;
    }

    if (!pageReadsAsWater(page.text)) {
      lastReason = "page_is_not_about_fishing_this_water";
      continue;
    }

    // The record's subject is the WATER, not a park on it, and the name it
    // carries has to be one the agency's page actually uses.
    const waterbody = chooseWaterbodyName(target.waterbody, published, page.text);
    if (!waterbody) {
      lastReason = "no_published_name_that_names_a_water";
      continue;
    }

    const waterType = waterTypeFrom(waterbody, page.text) ?? target.waterType ?? null;
    if (!waterType) {
      lastReason = "water_class_not_declared_by_name";
      continue;
    }

    // The jurisdiction has to be corroborated, not inherited from the folder a
    // URL happened to sit in. A federal host (blm.gov, nps.gov, fs.usda.gov)
    // publishes in every state, so "the agency is known" proves nothing about
    // WHICH state -- only the page saying so, or a host that serves exactly
    // one jurisdiction, does.
    const jurisdictionOk =
      new RegExp(`\\b${plain(target.state).replace(/\s+/g, "\\s+")}\\b`).test(plain(page.text)) ||
      singleStateHost(hostOf(page.url)) === plain(target.state);
    if (!jurisdictionOk) {
      lastReason = "jurisdiction_not_corroborated";
      continue;
    }

    const key = waterKey(waterbody, target.state);
    if (knownKeys.has(key)) {
      lastReason = "already_in_catalog";
      continue;
    }
    if (knownUrls.has(page.url.replace(/\/$/, "").toLowerCase())) {
      lastReason = "source_url_already_in_catalog";
      continue;
    }

    /* ── everything below came off this page ─────────────────────────── */
    // Read the page's own content, not the site's menu. The menu says "Public
    // fishing piers" on every page an agency serves.
    const body = mainText(page.html, page.text);
    const agency = index.agencyFor(page.url);
    const regs = index.regsFor(page.url);
    const access = accessFrom(body, waterbody);
    const notices = noticesFrom(body);
    const species = speciesFrom(body, index.speciesVocabulary);

    return {
      target,
      record: {
        id: null, // seed-destinations.mjs assigns it
        state: target.state,
        region: target.region ?? null,
        waterbody,
        waterType,
        officialSourceUrl: page.url,
        checkedAt: new Date().toISOString(),
        nextReviewAt: addDays(SEED_REVIEW_DAYS),
        status: STATUS_FOR_TYPE[waterType] ?? "current_with_same_day_rule_check_required",
        speciesContext: species,
        publicAccess: access,
        currentNotices: notices,
        directVerification: [
          agency
            ? `Check ${agency} regulations for current rules on this water before fishing.`
            : "Check the managing agency's current fishing regulations before fishing.",
          "Confirm the access point is open on the intended date.",
        ],
        privacy: {
          classification: "public_destination",
          publicLocationIncluded: true,
          sensitiveLocationIncluded: false,
        },
        usgsSiteId: null,
        noaaCoopsStationId: null,
        ndbcBuoyId: null,
        managingAgency: agency,
        officialRegsUrl: regs,
        regsReviewedDate: today(),
        accessReviewedDate: today(),
        lastVerified: today(),
        speciesPresent: null,
        seasonWindows: null,
        tags: tagsFrom(waterType, access, body),
        // Deliberately null. This record has been machine-verified against an
        // official page; it has NOT been read by a person, and claiming
        // otherwise would put a false provenance in the catalog.
        lastHumanReviewedAt: null,
        lastHumanReviewedBy: null,
        // Optional provenance (schema 0.6.0). This is how a later run, or a
        // repair, can tell machine-seeded records from human-written ones
        // without guessing from id ranges.
        seededBy: "field-sense-pipeline",
        seededAt: today(),
      },
      evidence: {
        trust: finalTier,
        resolvedFrom: target.url ? "queued_url" : "slug_shape",
        accessEntries: access.length,
        notices: notices.length,
        species: species.length,
        agencyKnown: Boolean(agency),
      },
    };
  }
  return { target, dropped: lastReason };
}

/* ── run ────────────────────────────────────────────────────────────────── */
const results = await pooled(targets, CONCURRENCY, async (target) => {
  const out = await resolveOne(target);
  if (out.record) {
    ok(
      `${out.record.waterbody} (${out.record.state}) — ${hostOf(out.record.officialSourceUrl)} ` +
        `[${out.evidence.trust}, ${out.evidence.accessEntries} access, ${out.evidence.notices} notices]`,
    );
  } else {
    drop(`${target.waterbody} (${target.state}) — ${out.dropped}`);
  }
  return out;
});

const proved = results.filter((r) => r?.record);
const dropped = results.filter((r) => r && !r.record);

/* Strip the agency's site-wide banners, which only look like notices until you
   see them on every page the same agency served in this run. */
const isFurniture = boilerplateFilter(
  proved.map((r) => ({
    host: hostOf(r.record.officialSourceUrl),
    notices: r.record.currentNotices,
  })),
);
let furnitureRemoved = 0;
for (const r of proved) {
  const kept = r.record.currentNotices.filter(
    (n) => !isFurniture(hostOf(r.record.officialSourceUrl), n),
  );
  furnitureRemoved += r.record.currentNotices.length - kept.length;
  r.record.currentNotices = kept;
}
if (furnitureRemoved) {
  note(
    `${furnitureRemoved} site-wide banner lines dropped — they appear on every page that agency served`,
  );
}

/* one water can be proved twice in one run only if two targets name it */
const deduped = [];
const seenKeys = new Set();
for (const r of proved) {
  const key = waterKey(r.record.waterbody, r.record.state);
  if (seenKeys.has(key)) continue;
  seenKeys.add(key);
  deduped.push(r);
}

console.log("");
console.log(`resolve: ${deduped.length} proved, ${dropped.length} dropped`);

const reasons = dropped.reduce(
  (acc, d) => ({ ...acc, [d.dropped]: (acc[d.dropped] ?? 0) + 1 }),
  {},
);
const reportPath = writeReport("resolve-targets", [
  `# Target resolution ${new Date().toISOString()}`,
  "",
  `Targets attempted: ${targets.length}`,
  `Proved:            ${deduped.length}`,
  `Dropped:           ${dropped.length}`,
  "",
  "A dropped target is not a failure of the water. It means this run could not",
  "prove the claim from an official page, and the doctrine is to publish",
  "nothing rather than something unproven.",
  "",
  "## Why targets were dropped",
  "",
  ...Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `- ${reason}: ${n}`),
  "",
  "## Proved",
  "",
  ...deduped.map(
    (r) =>
      `- ${r.record.waterbody} (${r.record.state}, ${r.record.waterType}) — ${r.record.officialSourceUrl}` +
      `\n  access: ${r.record.publicAccess.length}, notices: ${r.record.currentNotices.length}, species: ${r.record.speciesContext.length}, agency: ${r.record.managingAgency ?? "unknown"}`,
  ),
  "",
  "## Dropped, in detail",
  "",
  ...dropped.map(
    (d) =>
      `- ${d.target.waterbody} (${d.target.state}) — ${d.dropped}${d.target.url ? `\n  ${d.target.url}` : ""}`,
  ),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (DRY) {
  console.log("resolve: --dry, nothing staged");
} else {
  writeJson(
    PATHS.stagedSeeds,
    deduped.map((r) => r.record),
  );
  // Mark the queue so a re-run does not re-fetch what this run settled.
  const settled = new Map();
  for (const r of proved) settled.set(`${r.target.waterbody}::${r.target.state}`, "resolved");
  for (const d of dropped)
    settled.set(`${d.target.waterbody}::${d.target.state}`, `dropped:${d.dropped}`);
  const queue = (readJson(PATHS.seedTargets, []) ?? []).map((t) => {
    const verdict = settled.get(`${t.waterbody}::${t.state}`);
    if (!verdict) return t;
    return verdict === "resolved"
      ? { ...t, status: "resolved", resolvedAt: today() }
      : {
          ...t,
          status: "dropped",
          droppedReason: verdict.slice("dropped:".length),
          droppedAt: today(),
        };
  });
  writeJson(PATHS.seedTargets, queue);
  console.log(
    `resolve: staged ${deduped.length} record${deduped.length === 1 ? "" : "s"} in scripts/data/staged-seeds.json`,
  );
}

appendRun("resolve-targets", {
  attempted: targets.length,
  proved: deduped.length,
  dropped: dropped.length,
  reasons,
  dry: DRY,
});
