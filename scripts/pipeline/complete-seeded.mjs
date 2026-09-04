#!/usr/bin/env node
/**
 * Supplemental official-source completion for newly machine-seeded waters.
 *
 * resolve-targets.mjs proves a water from one official page. That page often
 * does not carry every planning field. This pass looks for OTHER pages on the
 * same trusted agency host that explicitly name the same water, and merges only
 * fields those pages actually publish. It never searches blogs/tourism sites,
 * never substitutes a nearby water, and never marks a machine record human-read.
 *
 * Default scope is machine-seeded records from the last 3 days that are missing
 * access or species context. Current notices remain owned by the primary-page
 * resolve/refresh path so site-wide banner text is not accidentally imported.
 */
import { fileURLToPath } from "node:url";
import {
  readCatalogSources,
  writeJson,
  hostOf,
  trustTier,
  plain,
  argv,
  pooled,
  robotsAllows,
  fetchPage,
  fetchXml,
  declaredSitemaps,
  sitemapLocs,
  isSitemapIndex,
  links,
  pageCarriesPhrase,
  pageNamesWater,
  mainText,
  ok,
  drop,
  note,
  writeReport,
  appendRun,
} from "./lib.mjs";
import { accessFrom, speciesFrom } from "./extract.mjs";
import { agencyIndex } from "./agencies.mjs";

const args = argv();
const DAYS = Math.max(0, Number(args.days ?? 3));
const LIMIT = Math.max(1, Number(args.limit ?? 120));
const CONCURRENCY = Math.max(1, Math.min(4, Number(args.concurrency ?? 3)));
const MAX_CANDIDATES = Math.max(1, Math.min(12, Number(args.candidates ?? 7)));
const DRY = Boolean(args.dry);
const ALL_SEEDED = Boolean(args["all-seeded"]);

const MAX_CHILD_SITEMAPS = 24;
const MAX_URLS_PER_HOST = 60_000;
const SOURCE_RE = /\.(?:pdf|jpe?g|png|gif|zip|xlsx?|docx?|csv)$/i;
const SKIP_PATH_RE = /\/(news|press|media|events?|calendar|grants?|careers|jobs|about|contact|privacy|sitemap)\//i;
const CLASS_WORDS = new Set([
  "lake", "river", "creek", "reservoir", "pond", "bay", "bayou", "sound", "harbor",
  "harbour", "inlet", "slough", "fork", "spring", "springs", "flowage", "marsh",
  "brook", "lagoon", "channel", "impoundment", "the", "of", "at", "on", "in",
  "public", "corridor", "waters", "water", "area", "unit", "state", "park",
]);

const sources = readCatalogSources();
const catalog = sources.flatMap((source) => source.records);
const agency = agencyIndex();

const dayMs = 86_400_000;
const now = Date.now();
const seededAge = (record) => {
  const t = Date.parse(record.seededAt ?? "");
  return Number.isFinite(t) ? Math.floor((now - t) / dayMs) : Infinity;
};
const incomplete = (record) =>
  !(record.publicAccess ?? []).length ||
  !(record.speciesContext ?? []).length;

let queue = catalog.filter((record) =>
  record?.seededBy === "field-sense-pipeline" &&
  incomplete(record) &&
  (ALL_SEEDED || seededAge(record) <= DAYS),
);
queue = queue.slice(0, LIMIT);

console.log(`complete-seeded: ${queue.length} incomplete machine-seeded record(s) selected`);
if (!queue.length) process.exit(0);

const sitemapCache = new Map();

async function sitemapUrls(host) {
  if (sitemapCache.has(host)) return sitemapCache.get(host);
  const promise = (async () => {
    const urls = new Set();
    const seen = new Set();
    const queue = [...(await declaredSitemaps(`https://${host}`))];
    let read = 0;

    while (queue.length && urls.size < MAX_URLS_PER_HOST && read <= MAX_CHILD_SITEMAPS) {
      const sm = queue.shift();
      if (!sm || seen.has(sm) || hostOf(sm) !== host) continue;
      seen.add(sm);
      const res = await fetchXml(sm);
      read += 1;
      if (!res.ok) continue;
      const locs = sitemapLocs(res.xml);
      if (isSitemapIndex(res.xml)) {
        for (const child of locs.slice(0, MAX_CHILD_SITEMAPS)) queue.push(child);
      } else {
        for (const url of locs) if (hostOf(url) === host) urls.add(url);
      }
    }
    return [...urls];
  })();
  sitemapCache.set(host, promise);
  return promise;
}

function nameTokens(name) {
  return plain(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !CLASS_WORDS.has(token));
}

function candidateScore(url, record) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return -1;
  }
  if (SOURCE_RE.test(parsed.pathname) || SKIP_PATH_RE.test(parsed.pathname)) return -1;
  const path = plain(decodeURIComponent(parsed.pathname)).replace(/[^a-z0-9]+/g, " ");
  const tokens = nameTokens(record.waterbody);
  if (!tokens.length) return -1;
  const hit = tokens.filter((token) => new RegExp(`\\b${token}\\b`).test(path)).length;
  const need = Math.min(2, tokens.length);
  if (hit < need) return -1;
  const phrase = plain(record.waterbody).replace(/[^a-z0-9]+/g, " ").trim();
  return hit * 10 + (phrase && path.includes(phrase) ? 20 : 0) - parsed.pathname.length / 200;
}

const norm = (value) => plain(value).replace(/[^a-z0-9]+/g, " ").trim();

function mergeStrings(existing, found, cap) {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map(norm));
  let added = 0;
  for (const item of found ?? []) {
    const key = norm(item);
    if (!key || seen.has(key) || out.length >= cap) continue;
    seen.add(key);
    out.push(item);
    added += 1;
  }
  return { list: out, added };
}

function mergeAccess(existing, found, cap = 12) {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map((item) => norm(item.name)));
  let added = 0;
  for (const item of found ?? []) {
    const key = norm(item?.name);
    if (!key || seen.has(key) || out.length >= cap) continue;
    seen.add(key);
    out.push(item);
    added += 1;
  }
  return { list: out, added };
}

async function supplementalCandidates(record) {
  const host = hostOf(record.officialSourceUrl);
  if (!host || trustTier(record.officialSourceUrl) === "untrusted") return [];
  const found = new Map();

  // Links on the already-proved page are the strongest supplemental leads.
  if (await robotsAllows(record.officialSourceUrl)) {
    const source = await fetchPage(record.officialSourceUrl, { timeoutMs: 15_000, retries: 0 });
    if (source.ok) {
      for (const link of links(source.html, source.url)) {
        if (hostOf(link.href) !== host || link.href === source.url) continue;
        const baseScore = candidateScore(link.href, record);
        if (baseScore > 0) {
          const score = baseScore + 30;
          found.set(link.href, Math.max(score, found.get(link.href) ?? -1));
        }
      }
    }
  }

  // Then use the agency sitemap so a separate access/species page can be found
  // even when the primary water page does not link to it.
  for (const url of await sitemapUrls(host)) {
    const canonical = url.replace(/\/$/, "");
    if (canonical === record.officialSourceUrl.replace(/\/$/, "")) continue;
    const score = candidateScore(url, record);
    if (score > 0) found.set(url, Math.max(score, found.get(url) ?? -1));
  }

  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CANDIDATES)
    .map(([url]) => url);
}

const updates = new Map();
const detailRows = [];

await pooled(queue, CONCURRENCY, async (record) => {
  const urls = await supplementalCandidates(record);
  let access = [...(record.publicAccess ?? [])];
  let species = [...(record.speciesContext ?? [])];
  const used = [];

  for (const url of urls) {
    if (!(await robotsAllows(url))) continue;
    const page = await fetchPage(url, { timeoutMs: 15_000, retries: 1 });
    if (!page.ok || trustTier(page.url) === "untrusted") continue;

    const namesWater =
      pageCarriesPhrase(page.text, record.waterbody) ||
      pageNamesWater(page.text, record.waterbody, { title: page.title });
    if (!namesWater) continue;

    const body = mainText(page.html, page.text);
    const foundAccess = accessFrom(body, record.waterbody);
    const foundSpecies = speciesFrom(body, agency.speciesVocabulary);
    if (!foundAccess.length && !foundSpecies.length) continue;

    const a = mergeAccess(access, foundAccess);
    const s = mergeStrings(species, foundSpecies, 16);
    access = a.list;
    species = s.list;

    if (a.added || s.added) {
      used.push({ url: page.url, access: a.added, species: s.added });
    }

    if (access.length && species.length) break;
  }

  if (!used.length) {
    drop(`${record.waterbody} (${record.state}) — no additional official-source fields found`);
    detailRows.push({ record, used: [] });
    return;
  }

  updates.set(record.id, {
    ...record,
    publicAccess: access,
    speciesContext: species,
    // Do not change lastVerified/checkedAt here: those dates belong to the
    // primary officialSourceUrl, which refresh.mjs owns.
  });
  detailRows.push({ record, used });
  ok(`${record.waterbody} (${record.state}) — +supplemental official evidence from ${used.length} page(s)`);
});

const reportPath = writeReport("complete-seeded", [
  `# Supplemental seed completion ${new Date().toISOString()}`,
  "",
  `Selected: ${queue.length}`,
  `Improved: ${updates.size}`,
  `Dry run: ${DRY ? "yes" : "no"}`,
  "",
  "Only additional pages on the same trusted agency host were accepted, and",
  "each accepted page had to name the exact water. Human-review provenance and",
  "primary-source review dates are deliberately unchanged.",
  "",
  "## Improved records",
  "",
  ...detailRows.filter((row) => row.used.length).flatMap((row) => [
    `- ${row.record.id} ${row.record.waterbody} (${row.record.state})`,
    ...row.used.map((hit) => `  - +${hit.access} access, +${hit.species} species — ${hit.url}`),
  ]),
  "",
  "## No additional evidence found",
  "",
  ...detailRows.filter((row) => !row.used.length).map((row) => `- ${row.record.id} ${row.record.waterbody} (${row.record.state})`),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (!DRY && updates.size) {
  let files = 0;
  for (const source of sources) {
    if (!source.records.some((record) => updates.has(record.id))) continue;
    writeJson(source.path, source.records.map((record) => updates.get(record.id) ?? record));
    files += 1;
  }
  console.log(`complete-seeded: ${updates.size} record(s) improved across ${files} catalog file(s)`);
} else if (DRY) {
  console.log("complete-seeded: dry run; catalog not written");
}

appendRun("complete-seeded", {
  selected: queue.length,
  improved: updates.size,
  dry: DRY,
});
