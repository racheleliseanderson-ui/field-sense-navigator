#!/usr/bin/env node
/**
 * Shared plumbing for the waterways seeding / refresh pipeline.
 *
 * Everything here exists to serve one rule from AGENTS.project.md: a field is
 * believed only when an official page actually said it. So this module owns
 * three things and nothing else -- how a page is fetched, whether the host it
 * came from is allowed to be believed, and whether the page that came back is
 * really about the water we asked for.
 *
 * No network calls happen at import time.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PATHS = {
  destinations: join(ROOT, "src/data/destinations.json"),
  destinationShards: join(ROOT, "src/data/destinations"),
  seedTargets: join(ROOT, "scripts/data/seed-targets.json"),
  stagedSeeds: join(ROOT, "scripts/data/staged-seeds.json"),
  discoverySources: join(ROOT, "scripts/data/discovery-sources.json"),
  stationBindings: join(ROOT, "src/data/station-bindings.json"),
  reports: join(ROOT, "reports"),
};

/* ── agency contact, as resolve-stations.mjs already publishes it ───────── */
const CONTACT =
  process.env.AGENCY_CONTACT_URL || "https://northernlanternhouse.com/customer-support";
export const UA = `HookTheHorizon-FieldSense/0.6 (+https://waterways.hookthehorizon.blog; contact ${CONTACT})`;

/* ── json io ────────────────────────────────────────────────────────────── */
export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * The catalog is the base file PLUS any jurisdiction shards, exactly as
 * assert-catalog.mjs assembles it. Reading only the base file is how a
 * pipeline hands out an id a shard already uses -- so nothing here reads the
 * base file on its own.
 *
 * @returns {{path:string, records:object[]}[]} base first, then shards by name.
 */
export function readCatalogSources() {
  const base = readJson(PATHS.destinations, []);
  if (!Array.isArray(base)) throw new Error("destinations.json must be a JSON array");
  const sources = [{ path: PATHS.destinations, records: base }];

  if (existsSync(PATHS.destinationShards)) {
    const names = readdirSync(PATHS.destinationShards)
      .filter((n) => n.endsWith(".json"))
      .sort();
    for (const name of names) {
      const path = join(PATHS.destinationShards, name);
      const records = readJson(path, []);
      if (Array.isArray(records)) sources.push({ path, records });
    }
  }
  return sources;
}

/** Every record the build will see, base and shards together. */
export function readCatalog() {
  return readCatalogSources().flatMap((s) => s.records);
}

/* ── trust ──────────────────────────────────────────────────────────────── */
/**
 * Two tiers may be believed, and they are recorded separately so a later
 * reviewer can tell which is which.
 *
 *   "government" -- the agency itself, or a government portal.
 *   "authority"  -- a named public authority, district, commission or
 *                   conservation body that is not on a government TLD.
 *
 * Everything else is untrusted. Tourism boards, chambers of commerce and
 * aggregators are named explicitly because they are the ones that look
 * plausible and are wrong: a CVB page will happily describe a lake it has no
 * standing to describe, and that is exactly the claim this catalog must not
 * carry.
 */
export const GOV_HOSTS = new Set([
  // agency hosts on non-.gov TLDs that ARE the agency
  "myfwc.com",
  "myodfw.com",
  "myfwp.mt.gov",
  "agfc.com",
  "azgfd.com",
  "ndow.org",
  "mdwfp.com",
  "ksoutdoors.com",
  "wildlifedepartment.com",
  "georgiawildlife.com",
  "outdooralabama.com",
  "vtfishandwildlife.com",
  "fishandboat.com",
  "floridastateparks.org",
  "parksandrecreation.idaho.gov",
  "cpw.state.co.us",
  "dnr.state.mn.us",
  "wildlife.state.nm.us",
  "ifishillinois.org",
  // Canadian federal / provincial portals
  "ontario.ca",
  "quebec.ca",
  "saskatchewan.ca",
  "novascotia.ca",
  "yukon.ca",
  "bcparks.ca",
  "albertaparks.ca",
  "ontarioparks.ca",
  "parkscanadahistory.com",
  "princeedwardisland.ca",
  "albertaregulations.ca",
  "envrbrportal.crm.saskatchewan.ca",
  // City and county governments that publish their own water access, on .org
  // or a vanity domain rather than .gov. A municipality is government; the
  // domain it chose does not change that.
  "auroragov.org",
  "pinellascounty.org",
  "rivcoparks.org",
  "countyofsb.org",
  "monocounty.org",
  "crystalriverfl.org",
  "ocean.floridamarine.org",
]);

/** Named public authorities, districts and conservation bodies. Not government TLDs. */
export const AUTHORITY_HOSTS = new Set([
  "ncwildlife.org",
  "coastalgadnr.org",
  "castaiclake.com",
  "bbmwd.com",
  "mwdh2o.com",
  "corpslakes.erdc.dren.mil",
]);

/** Hosts that describe water they have no standing to describe. */
const DENY_HOST_RE = /(^|\.)(visit[a-z-]*|[a-z-]*tourism[a-z-]*|[a-z-]*cvb|chamber[a-z-]*)\./i;
const DENY_HOSTS = new Set([
  "tripadvisor.com",
  "yelp.com",
  "wikipedia.org",
  "fishbrain.com",
  "onxmaps.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "pinterest.com",
  "youtube.com",
  "tiktok.com",
  "alltrails.com",
  "google.com",
  "lakelubbers.com",
  "fishingbooker.com",
  "hugedomains.com",
  "afternic.com",
  "portaransas.org",
  "portisabelsouthpadre.com",
  "visitcorpuschristi.com",
  "destinfwb.com",
  "navarrebeachpier.com",
]);

/**
 * Hosts that publish in every state and can therefore never vouch for one.
 *
 * This is the hole that put thirty-five BLM records -- rivers in California,
 * Oregon and Arizona -- into the catalog as Idaho. A federal agency's site is
 * a perfectly good SOURCE; it is simply not evidence of jurisdiction, and a
 * small sample of records that happen to share a state must not be mistaken
 * for evidence that the host serves only that state.
 */
export const MULTI_STATE_HOSTS = new Set([
  "blm.gov",
  "nps.gov",
  "fs.usda.gov",
  "fws.gov",
  "usbr.gov",
  "usace.army.mil",
  "noaa.gov",
  "epa.gov",
  "usgs.gov",
  "recreation.gov",
  "corpslakes.erdc.dren.mil",
  "canada.ca",
  "dfo-mpo.gc.ca",
  "pac.dfo-mpo.gc.ca",
]);

/** True when a host serves many jurisdictions and cannot imply one. */
export function isMultiStateHost(host) {
  const bare = String(host ?? "")
    .replace(/^www\d*\./, "")
    .toLowerCase();
  if (MULTI_STATE_HOSTS.has(bare)) return true;
  for (const listed of MULTI_STATE_HOSTS) if (bare.endsWith(`.${listed}`)) return true;
  return false;
}

export function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * @returns {"government"|"authority"|"untrusted"}
 */
export function trustTier(url) {
  const host = hostOf(url);
  if (!host) return "untrusted";
  const bare = host.replace(/^www\d*\./, "");
  for (const deny of DENY_HOSTS) {
    if (bare === deny || bare.endsWith(`.${deny}`)) return "untrusted";
  }
  if (DENY_HOST_RE.test(`.${bare}.`)) return "untrusted";

  if (matchesHost(GOV_HOSTS, bare)) return "government";
  if (/\.gov$/.test(bare)) return "government";
  if (/\.mil$/.test(bare)) return "government";
  if (/\.state\.[a-z]{2}\.us$/.test(bare)) return "government";
  if (/(^|\.)gov\.[a-z]{2}\.ca$/.test(bare)) return "government"; // gov.mb.ca, gov.nl.ca
  if (/(^|\.)gov\.bc\.ca$/.test(bare)) return "government";
  if (/\.gc\.ca$/.test(bare)) return "government"; // federal Canada
  if (/\.gouv\.qc\.ca$/.test(bare)) return "government";
  if (/(^|\.)gnb\.ca$/.test(bare)) return "government";
  if (/\.gov\.[a-z]{2}$/.test(bare)) return "government";

  if (matchesHost(AUTHORITY_HOSTS, bare)) return "authority";
  return "untrusted";
}

/**
 * Exact host, or a subdomain of a listed host. `gis.myfwc.com` is FWC serving
 * a map application; treating it as a stranger because the Set holds only
 * `myfwc.com` would drop the agency's own page.
 */
function matchesHost(set, bare) {
  if (set.has(bare)) return true;
  for (const listed of set) if (bare.endsWith(`.${listed}`)) return true;
  return false;
}

export const isTrusted = (url) => trustTier(url) !== "untrusted";

/* ── waterbody name handling ────────────────────────────────────────────── */
/**
 * Words that describe the CLASS of water rather than identify one. "Lake
 * Washington" and "Washington" must not be treated as the same claim, so the
 * class word is dropped for matching but the remaining token still has to
 * appear on the page.
 */
export const CLASS_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "at",
  "on",
  "in",
  "by",
  "north",
  "south",
  "east",
  "west",
  "upper",
  "lower",
  "middle",
  "big",
  "little",
  "old",
  "new",
  "lake",
  "lakes",
  "river",
  "rivers",
  "creek",
  "crick",
  "brook",
  "stream",
  "reservoir",
  "pond",
  "ponds",
  "bayou",
  "bay",
  "harbor",
  "harbour",
  "slough",
  "fork",
  "branch",
  "run",
  "spring",
  "springs",
  "sound",
  "strait",
  "channel",
  "canal",
  "flowage",
  "impoundment",
  "basin",
  "arm",
  "inlet",
  "cove",
  "lagoon",
  "marsh",
  "swamp",
  "wash",
  "draw",
  "gulch",
  "estuary",
  "delta",
  "pool",
  "pit",
  "pits",
  "quarry",
  "wma",
  "sra",
  "state",
  "park",
  "unit",
  "area",
  "access",
]);

export const plain = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[‘’']/g, "");

export const waterTokens = (name) =>
  plain(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !CLASS_WORDS.has(t));

/** Loose key for "is this the same water in the same jurisdiction". */
export const waterKey = (waterbody, state) =>
  `${plain(waterbody).replace(/[^a-z0-9]+/g, "")}::${plain(state).replace(/[^a-z0-9]+/g, "")}`;

/**
 * A page must NAME the water, not merely exist at a plausible URL.
 *
 * One distinctive token has to be present exactly; two or more tokens require
 * at least half of them. The class word is checked separately and loosely --
 * a page about "Lake Wingra" that never says "lake" anywhere is a page about
 * something else.
 */
export function pageNamesWater(pageText, waterbody, { title = "" } = {}) {
  const tokens = waterTokens(waterbody);
  if (!tokens.length) return false;
  const hay = plain(`${title} ${String(pageText).slice(0, 200_000)}`);
  const hits = tokens.filter((t) => new RegExp(`\\b${t}\\b`).test(hay)).length;
  if (tokens.length === 1) return hits === 1;
  return hits >= Math.max(2, Math.ceil(tokens.length / 2));
}

/** The whole phrase, in order, somewhere on the page. Strongest signal. */
export function pageCarriesPhrase(pageText, waterbody) {
  const phrase = plain(waterbody)
    .replace(/[^a-z0-9]+/g, "\\s+")
    .trim();
  if (!phrase) return false;
  return new RegExp(`\\b${phrase}\\b`).test(plain(String(pageText).slice(0, 200_000)));
}

const FISHING_RE =
  /\b(fishing|angler|anglers|angling|boat launch|boat ramp|launch ramp|fishing pier|fishing access|public access|shore access|trout|bass|walleye|salmon|panfish|catfish|stocked|creel|regulations|license|licence)\b/i;

/** Reads like a page about fishing this water, not a press release that names it. */
export const pageReadsAsWater = (pageText) => FISHING_RE.test(String(pageText).slice(0, 200_000));

/* ── html ───────────────────────────────────────────────────────────────── */
export function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * The page's own content, without the site's navigation and footer.
 *
 * This matters more than it looks. An agency's global menu carries "Public
 * fishing piers" and "Fishing regulations" on every page it serves, so reading
 * the whole document makes every creek in the state appear to publish a pier
 * and every page appear to carry an advisory. `<main>` is what the agency
 * itself marked as this page's subject, so that is what gets read.
 *
 * Falls back to the whole page when nothing is marked -- a page with no main
 * region still has to be readable, just less precisely.
 */
export function mainText(html, fallback = "") {
  const source = String(html);
  for (const re of [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  ]) {
    const m = re.exec(source);
    if (!m) continue;
    const text = stripHtml(m[1]);
    if (text.length >= 400) return text;
  }
  return fallback || stripHtml(source);
}

export function pageTitle(html) {
  const m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(String(html));
  return m ? stripHtml(m[1]) : "";
}

/** Anchors as [{href, text}], absolute where possible. */
export function links(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html))) && out.length < 4000) {
    let href = m[1].trim();
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      href = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const text = stripHtml(m[2]).replace(/\s+/g, " ").trim();
    if (text) out.push({ href, text });
  }
  return out;
}

/** Sentences, for notice extraction. Kept whole -- agency wording is reproduced. */
export function sentences(text) {
  return (
    String(text)
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      // A heading is not a sentence. "Planning Advisory Committee" contains the
      // word advisory and states nothing, so a floor on both length and word
      // count keeps navigation labels out of the notices a reader is shown.
      .filter((s) => s.length >= 40 && s.length <= 320 && s.split(/\s+/).length >= 6)
  );
}

/* ── fetch ──────────────────────────────────────────────────────────────── */
const SOFT_404_RE =
  /\b(page not found|404 error|the page you (?:are looking for|requested) (?:could not be found|does not exist)|no longer available|we can'?t find that page)\b/i;

/**
 * One page, with a real user agent string an agency webmaster can trace, a
 * hard timeout, and one retry on a transport error only. Never throws.
 *
 * @returns {Promise<{ok:boolean,status:number,url:string,html:string,text:string,title:string,reason:string|null}>}
 */
export async function fetchPage(url, { timeoutMs = 15_000, retries = 1 } = {}) {
  const fail = (reason, status = 0, finalUrl = url) => ({
    ok: false,
    status,
    url: finalUrl,
    html: "",
    text: "",
    title: "",
    reason,
  });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const finalUrl = res.url || url;
      if (!res.ok) return fail(`http_${res.status}`, res.status, finalUrl);

      const type = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
        return fail(`content_type_${type.split(";")[0] || "unknown"}`, res.status, finalUrl);
      }

      const html = (await res.text()).slice(0, 2_500_000);
      const text = stripHtml(html);
      if (text.length < 200) return fail("page_empty", res.status, finalUrl);
      if (SOFT_404_RE.test(text.slice(0, 4000))) return fail("soft_404", res.status, finalUrl);

      return {
        ok: true,
        status: res.status,
        url: finalUrl,
        html,
        text,
        title: pageTitle(html),
        reason: null,
      };
    } catch (err) {
      const reason =
        err?.name === "TimeoutError" ? "timeout" : `network_${err?.message || "error"}`;
      if (attempt === retries) return fail(reason);
      await sleep(900 * (attempt + 1));
    }
  }
  return fail("unreachable");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounded-concurrency map that preserves input order and never rejects. */
export async function pooled(items, concurrency, worker) {
  const list = [...items];
  const out = new Array(list.length);
  let cursor = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(concurrency, list.length || 1)) },
    async () => {
      for (;;) {
        const i = cursor++;
        if (i >= list.length) return;
        try {
          out[i] = await worker(list[i], i);
        } catch (err) {
          out[i] = { error: String(err?.message || err) };
        }
      }
    },
  );
  await Promise.all(lanes);
  return out;
}

/* ── reporting ──────────────────────────────────────────────────────────── */
export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(days, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Writes reports/<name>-<timestamp>.md and returns the path. */
export function writeReport(name, lines) {
  mkdirSync(PATHS.reports, { recursive: true });
  const path = join(PATHS.reports, `${name}-${stamp()}.md`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

export function appendRun(name, payload) {
  mkdirSync(PATHS.reports, { recursive: true });
  appendFileSync(
    join(PATHS.reports, "pipeline-runs.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), run: name, ...payload })}\n`,
    "utf8",
  );
}

export const ok = (msg) => console.log(`  + ${msg}`);
export const drop = (msg) => console.log(`  - ${msg}`);
export const note = (msg) => console.log(`    ${msg}`);

/** Tiny --flag=value parser shared by every entry point here. */
export function argv(args = process.argv.slice(2)) {
  return Object.fromEntries(
    args.map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    }),
  );
}

/* ── robots.txt ─────────────────────────────────────────────────────────── */
/**
 * This pipeline talks to five federal agencies, fifty state agencies and a
 * dozen provincial ones. Honouring robots.txt is not optional politeness at
 * that volume -- it is the difference between a tolerated client and a blocked
 * one, and a blocked agency host means records that can never be refreshed.
 *
 * Deliberately minimal: User-agent: * rules only, longest-prefix wins, Allow
 * beats Disallow at equal length. Anything unparseable is treated as allowed,
 * because a malformed robots.txt must not silently freeze the catalog.
 */
const robotsCache = new Map();

async function loadRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const promise = (async () => {
    const rules = { allow: [], disallow: [], sitemaps: [] };
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return rules;
      const body = (await res.text()).slice(0, 500_000);
      let applies = false;
      for (const rawLine of body.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, "").trim();
        if (!line) continue;
        const [rawKey, ...rest] = line.split(":");
        const key = rawKey.trim().toLowerCase();
        const value = rest.join(":").trim();
        if (key === "sitemap" && value) rules.sitemaps.push(value);
        else if (key === "user-agent") applies = value === "*";
        else if (applies && key === "disallow" && value) rules.disallow.push(value);
        else if (applies && key === "allow" && value) rules.allow.push(value);
      }
    } catch {
      /* unreachable robots.txt means no stated rules */
    }
    return rules;
  })();
  robotsCache.set(origin, promise);
  return promise;
}

export async function robotsAllows(url) {
  let origin;
  let path;
  try {
    const u = new URL(url);
    origin = u.origin;
    path = `${u.pathname}${u.search}`;
  } catch {
    return false;
  }
  const rules = await loadRobots(origin);
  const deny = longestMatch(rules.disallow, path);
  if (deny < 0) return true;
  return longestMatch(rules.allow, path) >= deny;
}

/**
 * Longest matching rule wins, and length is measured on the PATTERN, per the
 * robots spec. `*` is a wildcard and a trailing `$` anchors the end -- naive
 * prefix matching gets a rule whose pattern STARTS with a wildcard
 * catastrophically wrong, reading it as "disallow everything".
 *
 * @returns {number} pattern length of the longest match, or -1 for no match.
 */
function longestMatch(patterns, path) {
  let best = -1;
  for (const pattern of patterns) {
    const anchored = pattern.endsWith("$");
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const source = body
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    let re;
    try {
      re = new RegExp(`^${source}${anchored ? "$" : ""}`);
    } catch {
      continue;
    }
    if (re.test(path) && pattern.length > best) best = pattern.length;
  }
  return best;
}

/** Sitemap URLs an origin declares in robots.txt, plus the conventional one. */
export async function declaredSitemaps(origin) {
  const rules = await loadRobots(origin);
  const list = rules.sitemaps.filter((s) => {
    try {
      return new URL(s).origin === origin;
    } catch {
      return false;
    }
  });
  return list.length ? [...new Set(list)] : [`${origin}/sitemap.xml`];
}

/** <loc> values out of a sitemap or sitemap index. */
export function sitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
}

export const isSitemapIndex = (xml) => /<sitemapindex[\s>]/i.test(String(xml));

/** Fetch XML without the HTML content-type gate fetchPage applies. */
export async function fetchXml(url, { timeoutMs = 25_000 } = {}) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, xml: "", reason: `http_${res.status}` };
    const xml = (await res.text()).slice(0, 20_000_000);
    return { ok: true, xml, reason: null };
  } catch (err) {
    return { ok: false, xml: "", reason: err?.name === "TimeoutError" ? "timeout" : "network" };
  }
}
