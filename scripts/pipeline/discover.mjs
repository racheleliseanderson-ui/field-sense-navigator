#!/usr/bin/env node
/**
 * Find named public waters the catalog does not have yet, from the agencies'
 * own sitemaps.
 *
 * The first version of this script crawled agency index pages. That fails on
 * most modern agency sites: the list of lakes is drawn by JavaScript, so the
 * HTML a fetch returns contains navigation and nothing else. Sitemaps do not
 * have that problem -- they are published precisely so a machine can enumerate
 * the site, they are declared in robots.txt, and they are complete.
 *
 * The shape of the search is learned from the catalog rather than declared:
 *
 *   1. Which hosts to ask        -> the hosts existing records already cite.
 *   2. Where waters live on them -> the path FAMILY those records sit in
 *                                   (e.g. /fishing/locations/lowland-lakes/).
 *   3. Which jurisdiction        -> the state those records agree on.
 *
 * So when an agency adds a lake page in a folder the catalog already knows,
 * discovery finds it, and nobody has to maintain a list of URLs in this repo.
 *
 * A discovered URL is a QUESTION, not a record. Nothing here writes src/data.
 * The name taken from the slug is provisional -- resolve-targets.mjs reads the
 * page and takes the published name, or drops the target.
 *
 * Hand-added sources go in scripts/data/discovery-sources.json:
 *   [{ "state": "Wisconsin", "url": "https://dnr.wisconsin.gov/topic/Fishing/lakes" }]
 *
 * Needs the internet.
 *
 *   node scripts/pipeline/discover.mjs
 *   node scripts/pipeline/discover.mjs --state=Montana
 *   node scripts/pipeline/discover.mjs --host=tpwd.texas.gov --limit=50
 *   node scripts/pipeline/discover.mjs --dry
 */
import {
  PATHS, readCatalog, readJson, writeJson, hostOf, trustTier, isTrusted,
  waterKey, plain, pooled, argv, ok, drop, note, writeReport, appendRun, today,
  declaredSitemaps, sitemapLocs, isSitemapIndex, fetchXml, robotsAllows,
} from "./lib.mjs";

const args = argv();
const DRY = Boolean(args.dry);
const ONLY_STATE = args.state ? plain(args.state) : null;
const ONLY_HOST = args.host ? String(args.host).replace(/^www\./, "").toLowerCase() : null;
const LIMIT = Number(args.limit) || 400;
const PER_HOST = Number(args["per-host"]) || 60;
const CONCURRENCY = Math.max(1, Math.min(4, Number(args.concurrency ?? 3)));
const MIN_FAMILY = Number(args["min-family"]) || 2;
const MAX_HOSTS = Number(args["max-hosts"] ?? args["max-sources"]) || 120;
const MAX_CHILD_SITEMAPS = 30;
const MAX_URLS_PER_HOST = 80_000;

/* ── what a slug has to look like to be a named water ───────────────────── */
/**
 * Matched on whole tokens, never as a substring. "freshwater" is a section of
 * a site; "water" is a class of thing. A substring test conflates them, and
 * conflating them turns /freshwater/ into a family whose every page -- Black
 * Bass, Crappie, Rulemaking -- looks like a lake.
 */
const WATER_CLASS_TOKENS = new Set([
  "lake", "lakes", "river", "rivers", "creek", "creeks", "reservoir", "reservoirs",
  "pond", "ponds", "bayou", "bay", "bays", "harbor", "harbour", "slough", "fork",
  "spring", "springs", "flowage", "sound", "marsh", "brook", "lagoon", "inlet",
  "impoundment", "cove", "channel",
]);

/** Slugs that are a topic, a species, a document or an application. */
const NOT_A_WATER_TOKENS = new Set([
  "index", "search", "map", "maps", "list", "all", "about", "contact", "news",
  "regulation", "regulations", "license", "licence", "licenses", "report",
  "reports", "form", "forms", "faq", "help", "calendar", "directory", "home",
  "default", "privacy", "accessibility", "sitemap", "rulemaking", "commercial",
  "recreational", "attractors", "hatchery", "hatcheries", "stocking", "forecast",
  "education", "safety", "outreach", "volunteer", "events", "media", "magazine",
  "bass", "crappie", "bream", "catfish", "striper", "stripers", "panfish",
  "trout", "salmon", "walleye", "snook", "tarpon", "redfish", "sunfish", "pike",
  "musky", "muskie", "shad", "bluegill", "flounder", "grouper", "snapper",
]);

const slugTokens = (slug) =>
  decodeURIComponent(String(slug))
    .replace(/\.(html?|phtml|aspx?)$/i, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hasWaterToken = (tokens) => tokens.some((t) => WATER_CLASS_TOKENS.has(t));

/**
 * A candidate needs a class word and a name. "caddo-lake" has both. "lakes-and-
 * rivers" is all class and no name, so it is an index page. "black-bass" is a
 * species. Where the FOLDER supplies the class word -- a page slugged
 * "sam_rayburn" under /lakes/ -- the slug only has to supply the name.
 */
function looksLikeNamedWater(slug, familyPrefix) {
  const tokens = slugTokens(slug);
  if (!tokens.length || tokens.length > 6) return false;
  if (tokens.some((t) => NOT_A_WATER_TOKENS.has(t))) return false;
  if (/\d{4}/.test(slug)) return false;
  if (/\.(pdf|jpe?g|png|gif|zip|xlsx?|docx?|csv)$/i.test(slug)) return false;

  const familyHasClass = hasWaterToken(slugTokens(familyPrefix.replace(/\//g, "-")));
  const slugHasClass = hasWaterToken(tokens);
  if (!slugHasClass && !familyHasClass) return false;

  const nameTokens = tokens.filter(
    (t) => !WATER_CLASS_TOKENS.has(t) && !["the", "of", "and", "at", "on", "in"].includes(t),
  );
  return nameTokens.length >= 1;
}

const TITLE_CASE_MINOR = new Set(["of", "the", "at", "on", "in", "and", "de", "la", "du"]);

/** "lake-of-the-woods" -> "Lake of the Woods". Provisional only. */
function nameFromSlug(slug) {
  const words = decodeURIComponent(slug)
    .replace(/\.(html?|phtml|aspx?)$/i, "")
    .split(/[-_+]+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words
    .map((w, i) =>
      i > 0 && TITLE_CASE_MINOR.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

function pathParts(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

/* ── families: where this host keeps its waters, per the catalog ─────────── */
/**
 * A record at /fishboat/fish/recreational/lakes/fork/ contributes both
 * /fishboat/fish/recreational/lakes/ (its parent) and, because that parent may
 * hold only this one record, the grandparent is considered too. Families need
 * MIN_FAMILY supporting records, which is what keeps a one-off URL from
 * turning the whole site into a search space.
 */
function familiesFor(records) {
  const tally = new Map();
  for (const r of records) {
    const parts = pathParts(r.officialSourceUrl);
    if (parts.length < 2) continue;
    for (const depth of [parts.length - 1, parts.length - 2]) {
      if (depth < 1) continue;
      const prefix = `/${parts.slice(0, depth).join("/")}/`;
      const entry = tally.get(prefix) ?? { prefix, n: 0, states: new Map() };
      entry.n += 1;
      entry.states.set(r.state, (entry.states.get(r.state) ?? 0) + 1);
      tally.set(prefix, entry);
    }
  }
  return [...tally.values()]
    .filter((f) => f.n >= MIN_FAMILY && f.prefix !== "/")
    .map((f) => {
      const [state, n] = [...f.states.entries()].sort((a, b) => b[1] - a[1])[0];
      return { prefix: f.prefix, support: f.n, state, stateShare: n / f.n };
    })
    // A family spanning jurisdictions (nps.gov, fs.usda.gov) cannot tell us
    // which state a new record belongs to, and a guessed jurisdiction is a
    // wrong record. Those families are skipped, not guessed at.
    .filter((f) => f.stateShare >= 0.8)
    .sort((a, b) => b.support - a.support);
}

/* ── main ───────────────────────────────────────────────────────────────── */
const records = readCatalog();
const targets = readJson(PATHS.seedTargets, []) ?? [];

const known = new Set(records.map((r) => waterKey(r.waterbody, r.state)));
const knownUrls = new Set(
  records.map((r) => String(r.officialSourceUrl ?? "").replace(/\/$/, "").toLowerCase()),
);
const queued = new Set(targets.map((t) => waterKey(t.waterbody, t.state)));
const queuedUrls = new Set(
  targets.map((t) => String(t.url ?? "").replace(/\/$/, "").toLowerCase()).filter(Boolean),
);

/* hosts, from the catalog */
const byHost = new Map();
for (const r of records) {
  const host = hostOf(r.officialSourceUrl);
  if (!host || !isTrusted(r.officialSourceUrl)) continue;
  byHost.set(host, [...(byHost.get(host) ?? []), r]);
}

let hosts = [...byHost.entries()]
  .map(([host, rs]) => ({ host, records: rs, families: familiesFor(rs) }))
  .filter((h) => h.families.length)
  .sort((a, b) => b.records.length - a.records.length);

if (ONLY_HOST) hosts = hosts.filter((h) => h.host === ONLY_HOST);
if (ONLY_STATE) hosts = hosts.filter((h) => h.families.some((f) => plain(f.state) === ONLY_STATE));
hosts = hosts.slice(0, MAX_HOSTS);

/* declared sources, treated as an extra family on their own host */
for (const source of readJson(PATHS.discoverySources, []) ?? []) {
  if (!source?.url || !isTrusted(source.url)) continue;
  const host = hostOf(source.url);
  const parts = pathParts(source.url);
  const prefix = `/${parts.join("/")}/`.replace(/\/+$/, "/");
  const family = { prefix, support: Infinity, state: source.state ?? null, stateShare: 1 };
  if (!family.state) continue;
  const existing = hosts.find((h) => h.host === host);
  if (existing) existing.families.unshift(family);
  else hosts.unshift({ host, records: [], families: [family] });
}

console.log(
  `discover: ${hosts.length} agency hosts, ${records.length} records held, ${targets.length} already queued`,
);
if (!hosts.length) {
  console.log("discover: no host matched. Try --host= or add a page to scripts/data/discovery-sources.json.");
  process.exit(0);
}

const found = [];
const hostNotes = [];

await pooled(hosts, CONCURRENCY, async (entry) => {
  if (found.length >= LIMIT) return;
  const origin = `https://${entry.host}`;
  const roots = await declaredSitemaps(origin);

  /* expand sitemap indexes one level */
  const urls = new Set();
  let sitemapsRead = 0;
  const queue = [...roots];
  const seenSitemaps = new Set();

  while (queue.length && urls.size < MAX_URLS_PER_HOST && sitemapsRead <= MAX_CHILD_SITEMAPS) {
    const sm = queue.shift();
    if (!sm || seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    if (hostOf(sm) !== entry.host) continue;
    const res = await fetchXml(sm);
    sitemapsRead += 1;
    if (!res.ok) continue;
    const locs = sitemapLocs(res.xml);
    if (isSitemapIndex(res.xml)) {
      for (const child of locs.slice(0, MAX_CHILD_SITEMAPS)) queue.push(child);
    } else {
      for (const u of locs) urls.add(u);
    }
  }

  if (!urls.size) {
    hostNotes.push({ host: entry.host, note: "no readable sitemap" });
    drop(`${entry.host} — no readable sitemap`);
    return;
  }

  /* candidates: one segment below a known family */
  let addedHere = 0;
  const seenHere = new Set();

  for (const url of urls) {
    if (found.length >= LIMIT || addedHere >= PER_HOST) break;
    let path;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }

    const family = entry.families.find((f) => {
      if (!path.toLowerCase().startsWith(f.prefix.toLowerCase())) return false;
      const rest = path.slice(f.prefix.length).split("/").filter(Boolean);
      return rest.length === 1;
    });
    if (!family) continue;

    const slug = path.slice(family.prefix.length).replace(/\/$/, "");
    if (!slug || !looksLikeNamedWater(slug, family.prefix)) continue;

    const waterbody = nameFromSlug(slug);
    if (waterbody.length < 4 || waterbody.length > 60) continue;

    const canonical = url.replace(/\/$/, "").toLowerCase();
    if (knownUrls.has(canonical) || queuedUrls.has(canonical) || seenHere.has(canonical)) continue;
    const key = waterKey(waterbody, family.state);
    if (known.has(key) || queued.has(key)) continue;
    if (!(await robotsAllows(url))) continue;

    seenHere.add(canonical);
    queued.add(key);
    queuedUrls.add(canonical);
    found.push({
      waterbody,
      state: family.state,
      url,
      waterType: null,
      nameIsProvisional: true,
      discoveredFrom: `sitemap:${entry.host}${family.prefix}`,
      discoveredAt: today(),
      trust: trustTier(url),
      status: "queued",
    });
    addedHere += 1;
  }

  if (addedHere) ok(`${addedHere} candidate${addedHere === 1 ? "" : "s"} from ${entry.host} (${urls.size} sitemap URLs)`);
  else hostNotes.push({ host: entry.host, note: `nothing new in ${urls.size} sitemap URLs` });
});

console.log("");
console.log(`discover: ${found.length} new candidate waters across ${hosts.length} hosts`);

const byState = found.reduce((acc, f) => ({ ...acc, [f.state]: (acc[f.state] ?? 0) + 1 }), {});
const reportPath = writeReport("discovery", [
  `# Discovery run ${new Date().toISOString()}`,
  "",
  `Hosts asked:       ${hosts.length}`,
  `Candidates queued: ${found.length}`,
  "",
  "These are questions, not records. resolve-targets.mjs must read each page",
  "and prove it names the water before anything enters the catalog.",
  "",
  "## By jurisdiction",
  "",
  ...Object.entries(byState)
    .sort((a, b) => b[1] - a[1])
    .map(([state, n]) => `- ${state}: ${n}`),
  "",
  "## Candidates",
  "",
  ...found.map((f) => `- ${f.waterbody} (${f.state}) — ${f.url}`),
  "",
  "## Hosts that yielded nothing",
  "",
  ...hostNotes.map((h) => `- ${h.host} — ${h.note}`),
]);
note(`report: ${reportPath.slice(reportPath.lastIndexOf("reports"))}`);

if (DRY) {
  console.log("discover: --dry, seed-targets.json not written");
} else if (found.length) {
  writeJson(PATHS.seedTargets, [...targets, ...found]);
  console.log(`discover: seed-targets.json now holds ${targets.length + found.length} targets`);
}

appendRun("discover", { hosts: hosts.length, found: found.length, dry: DRY });
