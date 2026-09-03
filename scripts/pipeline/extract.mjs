#!/usr/bin/env node
/**
 * Read a verified agency page and return ONLY what it actually said.
 *
 * Every function here answers "what does this page publish?" and returns null
 * or an empty array when the answer is "it does not say". None of them fall
 * back to a plausible value. That is the whole contract: a seeded record with
 * a null field is a record a human can finish, while a seeded record with an
 * invented field is a record nobody can trust and nobody can find.
 */
import { sentences, plain } from "./lib.mjs";

/* ── the published name of the water ────────────────────────────────────── */
const TITLE_TAIL_RE =
  /\s*[|·—–-]\s*(?:(?:[A-Z][\w.'()]*|&|and|of|the|de|la|du)\s+){0,9}(?:Department|Commission|Agency|Division|Service|Wildlife|Parks?|Government|Ministry|Resources|Conservation|DNR|DNREC|FWP|TPWD|WDFW|CPW|DEC|DEP|FWC)\s*$/;

/** First <h1>, which agency templates use for the page's own subject. */
export function firstHeading(html) {
  const m = /<h1\b[^>]*>([\s\S]{0,240}?)<\/h1>/i.exec(String(html));
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The name the AGENCY publishes, preferred over the name we guessed from a
 * slug. Site furniture ("| Washington Department of Fish & Wildlife") is cut
 * off; nothing else is rewritten, because the published wording is the claim.
 */
export function publishedName(html, title) {
  const h1 = firstHeading(html);
  const candidate = h1 && h1.length >= 4 && h1.length <= 90 ? h1 : String(title ?? "");
  const trimmed = candidate.replace(TITLE_TAIL_RE, "").replace(/\s*[|·—–]\s*$/, "").trim();
  return trimmed.length >= 4 && trimmed.length <= 90 ? trimmed : null;
}

/* ── water class ────────────────────────────────────────────────────────── */
const TYPE_RULES = [
  [/\b(reservoir|impoundment|flowage)\b/i, "reservoir"],
  [/\b(bay|harbor|harbour|sound|inlet|strait|estuary|gulf|seashore|coast|coastal|marine|surf|jetty|channel)\b/i, "marine"],
  [/\b(river|creek|brook|stream|fork|bayou|slough|run|branch)\b/i, "river"],
  [/\b(lake|pond|lagoon|pool)\b/i, "lake"],
];

/**
 * The water CLASS from its published name. This is classification of a name,
 * not a claim about the water -- "Lake Livingston" is a lake because it is
 * called one. When the name does not say, this returns null and the target is
 * dropped rather than assigned a class it never declared.
 *
 * @returns {"reservoir"|"river"|"lake"|"marine"|null}
 */
export function waterTypeFrom(name, pageText = "") {
  for (const [re, type] of TYPE_RULES) if (re.test(name)) return type;
  // The name did not say. The page may, but only if it is unambiguous.
  const head = String(pageText).slice(0, 3000);
  const hits = TYPE_RULES.filter(([re]) => re.test(head)).map(([, t]) => t);
  return new Set(hits).size === 1 ? hits[0] : null;
}

/* ── access ─────────────────────────────────────────────────────────────── */
const FACILITY_RULES = [
  { re: /\b(boat ramps?|boat launch(?:es)?|launch ramps?|public ramps?)\b/i, kind: "boat_launch" },
  { re: /\b(fishing piers?|fishing jett(?:y|ies)|public piers?|wharf)\b/i, kind: "fishing_pier" },
  { re: /\b(kayak launch|canoe launch|hand launch|car[- ]top launch|paddle(?:craft)? launch)\b/i, kind: "hand_launch" },
  { re: /\b(bank fishing|shore fishing|shoreline access|bank access|walk[- ]in access|shore access)\b/i, kind: "shore_access" },
];

const TYPE_FOR_KINDS = (kinds) => {
  const has = (k) => kinds.includes(k);
  if (has("boat_launch") && has("fishing_pier")) return "boat_launch_and_fishing_pier";
  if (has("boat_launch") && has("shore_access")) return "boat_launch_and_shore_access";
  if (has("boat_launch")) return "boat_launch";
  if (has("fishing_pier")) return "fishing_pier";
  if (has("hand_launch")) return "hand_launch";
  if (has("shore_access")) return "shore_access";
  return null;
};

const NAMED_FACILITY_RE =
  /^[A-Z][A-Za-z0-9'’.\-& ]{3,60}\b(Boat Ramp|Boat Launch|Launch|Ramp|Fishing Pier|Pier|Access(?: Area| Site| Point)?|Landing|Marina)\b\.?$/;

/**
 * What the page publishes about getting on the water.
 *
 * Two passes. Named facilities come from short lines that read like a facility
 * name and nothing else ("Kenmore Boat Launch") -- a full sentence is prose
 * about a facility, not the facility's published name, so it is not used. If
 * no line qualifies, one summary entry records the KINDS of access the page
 * mentions, under the water's own published name.
 *
 * Every entry is officiallyPublished:true because every entry came off the
 * agency's page. A kind the page never mentions is simply absent -- per
 * doctrine, that is "unpublished", never "this water has no ramp".
 */
export function accessFrom(pageText, name) {
  const lines = String(pageText)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const named = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.length < 6 || line.length > 70) continue;
    if (!NAMED_FACILITY_RE.test(line)) continue;
    const clean = line.replace(/\.$/, "");
    const key = plain(clean);
    if (seen.has(key)) continue;
    const kinds = FACILITY_RULES.filter((r) => r.re.test(clean)).map((r) => r.kind);
    const type = TYPE_FOR_KINDS(kinds) ?? (/\b(landing|marina|ramp|launch)\b/i.test(clean) ? "boat_launch" : "shore_access");
    seen.add(key);
    named.push({ name: clean, type, officiallyPublished: true });
    if (named.length >= 6) break;
  }
  if (named.length) return named;

  const kinds = FACILITY_RULES.filter((r) => r.re.test(pageText)).map((r) => r.kind);
  const type = TYPE_FOR_KINDS(kinds);
  if (!type) return [];
  return [{ name: `${name} — access published by the managing agency`, type, officiallyPublished: true }];
}

/* ── notices ────────────────────────────────────────────────────────────── */
const NOTICE_RE =
  /\b(closed|closure|closures|temporarily closed|emergency (?:rule|closure)|restrictions?|prohibited|not permitted|no wake|advisory|advisories|consumption advisory|do not eat|boil water|permit required|reservation required|day[- ]use fee|entrance fee|low water|drawdown|aquatic invasive|invasive species|decontamination|inspection required|ice conditions|unsafe ice|blue[- ]green algae|harmful algal bloom|fire restrictions?|burn ban)\b/i;
const NOTICE_NEGATE_RE =
  /\bno (?:current )?(?:closures?|restrictions?|advisories)\b|\bnot closed\b|\bclosures?:\s*none\b/i;
const NOTICE_JUNK_RE =
  /\b(cookie|javascript|browser|newsletter|subscribe|copyright|all rights reserved|privacy policy|skip to)\b/i;
/**
 * A notice STATES something. "Mount Saint Helens Wildlife Area Advisory
 * Committee" contains the word advisory and is the name of a committee, so a
 * line has to either finish as a sentence or carry a word that makes a claim
 * before it is shown to a reader as a notice.
 */
const NOTICE_STATES_SOMETHING_RE =
  /[.!?]$|\b(is|are|was|were|will|shall|must|may|can|cannot|do not|does not|no|closed|closes|open|opens|required|prohibited|banned|restricted|allowed|apply|applies|effective|through|until)\b/i;

/**
 * The agency's own wording, reproduced. Never restated, never summarised --
 * "no translation layer" applies to paraphrase too. Sentences that merely deny
 * a closure are dropped, because "there are no closures" is not a notice.
 */
export function noticesFrom(pageText, { limit = 5 } = {}) {
  const out = [];
  const seen = new Set();
  for (const s of sentences(pageText)) {
    if (out.length >= limit) break;
    if (!NOTICE_RE.test(s)) continue;
    if (NOTICE_NEGATE_RE.test(s)) continue;
    if (NOTICE_JUNK_RE.test(s)) continue;
    if (!NOTICE_STATES_SOMETHING_RE.test(s)) continue;
    const key = plain(s).slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.length > 300 ? `${s.slice(0, 297).trimEnd()}...` : s);
  }
  return out;
}

/* ── species ────────────────────────────────────────────────────────────── */
/**
 * Species names that are also ordinary English words. "Permit" is a fish and
 * also the thing an agency page tells you to buy, so a bare match on it puts a
 * pompano in a Washington creek. These are only accepted as part of a longer
 * name ("Round pompano"), never on their own.
 */
const AMBIGUOUS_ALONE = new Set([
  "permit", "jack", "ray", "drum", "sole", "char", "skate", "grunt", "runner",
  "hind", "scad", "porgy", "chub", "dolly",
]);

/** Editorial phrases in the catalog's species field are not species names. */
export const plainSpecies = (vocabulary) =>
  vocabulary.filter(
    (s) =>
      /^[A-Za-z][A-Za-z' -]{2,34}$/.test(s) &&
      s.split(/\s+/).length <= 4 &&
      !(s.split(/\s+/).length === 1 && AMBIGUOUS_ALONE.has(s.toLowerCase())),
  );

/**
 * Species the page NAMES. Not species that live there -- this catalog does not
 * claim that, and the field is called speciesContext for exactly that reason.
 */
export function speciesFrom(pageText, vocabulary, { limit = 8 } = {}) {
  const hay = plain(pageText).slice(0, 200_000);
  const out = [];
  const seen = new Set();
  for (const term of plainSpecies(vocabulary)) {
    if (out.length >= limit) break;
    const needle = plain(term);
    if (seen.has(needle)) continue;
    if (!new RegExp(`\\b${needle.replace(/[-\s]+/g, "[\\s-]+")}\\b`).test(hay)) continue;
    seen.add(needle);
    out.push(term);
  }
  return out;
}

/* ── tags ───────────────────────────────────────────────────────────────── */
export function tagsFrom(waterType, access, pageText) {
  const tags = new Set();
  if (waterType) tags.add(waterType);
  const kinds = access.map((a) => a.type).join(" ");
  if (/boat_launch|hand_launch/.test(kinds)) tags.add("boat_ramp");
  if (/shore/.test(kinds)) tags.add("shore_access");
  if (/pier|wharf/.test(kinds)) tags.add("pier");
  if (/\bstate park\b/i.test(pageText)) tags.add("state_park");
  if (/\bnational park\b/i.test(pageText)) tags.add("national_park");
  if (/\bnational forest\b/i.test(pageText)) tags.add("national_forest");
  return [...tags].sort();
}

/* ── choosing the name the record carries ───────────────────────────────── */
/**
 * Designations that name a FACILITY on a water, not the water.
 *
 * "Caddo Lake State Park" is a park; the water is Caddo Lake. The catalog's
 * subject is the water, so the designation is peeled off -- but only from a
 * copy, and the peeled name still has to survive the same checks.
 */
const DESIGNATION_RE =
  /\s+(?:State\s+(?:Park|Natural\s+Area|Recreation\s+Area|Fishing\s+Lake|Wildlife\s+Area|Historic\s+Site)|National\s+(?:Park|Forest|Wildlife\s+Refuge|Recreation\s+Area|Seashore|Monument)|Wildlife\s+(?:Management\s+)?Area|State\s+Wildlife\s+Area|SWA|WMA|Fishing\s+Access\s+Site|Recreation\s+(?:Area|Site)|Conservation\s+Area|Natural\s+Area|Public\s+Fishing\s+Area|Campground|Marina|Boat\s+Ramp|Launch\s+Site|Access(?:\s+Area|\s+Site)?|Corridor|Unit|Park)\s*$/i;

/**
 * Names that are a document, a road or a landform rather than a body of water.
 *
 * These reach the pipeline because an agency's sitemap does not distinguish a
 * lake page from a management plan about a lake. "Lake Simcoe Protection Plan"
 * is a policy document; "Colorado River Headwaters Byway" is a road; "Fish
 * Creek Mountains Wilderness" is a mountain range. Each names a water and each
 * would pass every other gate, so they are refused by name.
 */
const NOT_A_WATERBODY_RE =
  /\b(Plan|Planning|Strategy|Policy|Report|Assessment|Laboratories|Laboratory|Byway|Highway|Trailhead|Trail|Wilderness|Mountains?|Lighthouse|Museum|Aquarium|Centre|Center|Headquarters|Building|Facility|Hatchery|Field\s+Office|District\s+Office|Program|Project|Act|Rule|Amendment|Expansion|Announced|Approved|Ruled|Proposed|Awarded)\b/i;

export const namesADocumentOrPlace = (name) => NOT_A_WATERBODY_RE.test(String(name ?? ""));

/**
 * Waterbody names are short. "Lake Casa Blanca" is three words, "North Fork
 * American River" is four; six words is a headline, not a name. The wide scan
 * in discover.mjs judges a URL on its slug alone, so without a length ceiling a
 * press item slugged "convention-center-expansion-ruled-legally-sound" arrives
 * looking like a body of water called Sound.
 */
const MAX_NAME_WORDS = 5;

/** Every reason a string must not become a record's waterbody. */
export function refuseAsWaterbodyName(name) {
  const text = String(name ?? "").trim();
  if (text.length < 4 || text.length > 70) return "length";
  if (text.split(/\s+/).length > MAX_NAME_WORDS) return "reads_as_a_sentence";
  if (namesADocumentOrPlace(text)) return "document_road_or_building";
  return null;
}

export function stripDesignation(name) {
  let out = String(name ?? "").trim();
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(DESIGNATION_RE, "").trim();
    if (next === out || next.length < 4) break;
    out = next;
  }
  return out;
}

const hasWaterClassWord = (name) => TYPE_RULES.some(([re]) => re.test(String(name)));

/**
 * Which of the names in play the record should carry.
 *
 * Order matters and is deliberate: the shortest name that still names a water
 * wins, because "Caddo Lake" is the water and "Caddo Lake State Park" is a
 * place on it. A name is only eligible if the page itself uses it -- the
 * catalog reproduces published wording, so a name assembled here that the
 * agency never wrote is not a name this record may carry.
 *
 * @returns {string|null} null when no candidate names a water.
 */
export function chooseWaterbodyName(targetName, published, pageText) {
  const hay = plain(pageText);
  const usedOnPage = (name) => {
    const phrase = plain(name).replace(/[^a-z0-9]+/g, "\\s+").trim();
    return Boolean(phrase) && new RegExp(`\\b${phrase}\\b`).test(hay);
  };

  // Designation-stripped forms are tried FIRST, whichever name they came from.
  // "Banks Lake Wildlife Area Unit" is a management unit; the water is Banks
  // Lake, and the catalog already holds it under that name -- keeping the unit
  // name would file the same lake twice under a name no angler searches for.
  const raw = [targetName, published].filter(Boolean).map((n) => String(n).trim());
  const candidates = [...raw.map(stripDesignation), ...raw];

  const seen = new Set();
  for (const name of candidates) {
    const key = plain(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (refuseAsWaterbodyName(name)) continue;
    if (!hasWaterClassWord(name)) continue;
    if (!usedOnPage(name)) continue;
    return name;
  }
  return null;
}


/* ── site furniture is not a notice about this water ────────────────────── */
/**
 * A wildfire banner, a cookie bar or a "check current regulations" strip sits
 * in an agency's template, so it appears on every page that agency serves. It
 * reads exactly like a notice and it is not one: it says nothing about THIS
 * water, and carrying it would put the same five sentences on two hundred
 * records and bury the one closure that matters.
 *
 * Boilerplate can only be recognised across a batch, so this runs once the
 * whole run is in hand: a sentence carried by many of the run's pages from the
 * same host is template, not evidence.
 *
 * @param {{host:string, notices:string[]}[]} pages
 * @returns {(host:string, notice:string) => boolean} true when it is furniture
 */
export function boilerplateFilter(pages, { minPages = 5, share = 0.4 } = {}) {
  const totals = new Map();
  const counts = new Map();
  for (const page of pages) {
    totals.set(page.host, (totals.get(page.host) ?? 0) + 1);
    for (const notice of new Set(page.notices.map((n) => plain(n).slice(0, 80)))) {
      const key = `${page.host}::${notice}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return (host, notice) => {
    const total = totals.get(host) ?? 0;
    if (total < minPages) return false;
    const n = counts.get(`${host}::${plain(notice).slice(0, 80)}`) ?? 0;
    return n / total >= share;
  };
}
