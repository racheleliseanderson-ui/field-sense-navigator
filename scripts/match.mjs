/**
 * Fail-closed name matching shared by USGS / NOAA / WSC resolvers.
 * Phrase + water-type must align. A modifier prefix (LITTLE BOW vs BOW)
 * is a miss. Ties are the caller's problem — they must not pick a neighbor.
 */

export const STOP = new Set([
  "the",
  "of",
  "waters",
  "quality",
  "state",
  "park",
  "public",
  "fas",
  "segments",
  "segment",
  "near",
  "at",
  "and",
  "corridor",
  "approaches",
  "published",
  "documented",
  "ramps",
  "ramp",
  "pier",
  "piers",
  "access",
  "site",
  "sites",
  "area",
  "memorial",
  "national",
  "seashore",
  "wildlife",
  "refuge",
  "cma",
  "fwc",
  "fwp",
  "usfs",
  "nps",
  "below",
  "above",
  "between",
  "from",
  "into",
  "complex",
  "network",
  "reach",
  "recreation",
  "basin",
]);

export const GENERIC_GEO = new Set([
  "michigan",
  "huron",
  "superior",
  "erie",
  "ontario",
  "atlantic",
  "pacific",
  "mexico",
  "approaches",
  "ocean",
]);

export const GENERIC = new Set([
  "river",
  "lake",
  "lakes",
  "lac",
  "lk",
  "creek",
  "reservoir",
  "res",
  "bay",
  "gulf",
  "ocean",
  "sound",
  "harbor",
  "harbour",
  "inlet",
  "lagoon",
  "pass",
  "channel",
  "pond",
  "fork",
  "stream",
  "brook",
  "riviere",
  "slough",
  "pool",
]);

export const TYPE_HINT = {
  lake: /\blake\b|\blk\b|\blac\b|\bpond\b|\breservoir\b|\bres\b|\bbay\b|\bharbor\b|\bharbour\b|\bsound\b/,
  reservoir: /\breservoir\b|\blake\b|\blk\b|\blac\b|\bres\b/,
  river:
    /\briver\b|\briviere\b|\brivière\b|\br\b|\brv\b|\bcreek\b|\bc\b|\bfork\b|\bstream\b|\bcanal\b|\bbrook\b|\bslough\b/,
  marine:
    /\bbay\b|\binlet\b|\bsound\b|\bharbor\b|\bharbour\b|\bgulf\b|\bocean\b|\btide\b|\blagoon\b|\bpass\b|\bchannel\b|\bstrait\b/,
};

const LAKE_FAMILY = new Set(["lake", "lakes", "lk", "lac", "pond", "reservoir", "res"]);
const MARINE_FAMILY = new Set([
  "bay",
  "inlet",
  "sound",
  "harbor",
  "harbour",
  "gulf",
  "ocean",
  "lagoon",
  "pass",
  "channel",
  "strait",
]);

const MODIFIER = "little|north|south|east|west|big|petite|petit|lower|upper|middle";

export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function tokens(water) {
  return norm(water)
    .split(" ")
    .filter((x) => x.length > 2 && !STOP.has(x));
}

/** Queries to send a name-based agency index. Official spelling variants only. */
export function searchQueries(water) {
  const first = String(water ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[—–].*$/, " ")
    .split(/[/+]| and /i)[0]
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = first;
  const stripped = cleaned
    .replace(
      /\b(lake|reservoir|river|res|riviere|rivière|state|park|recreation|area|public|corridor|national|seashore|complex)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const abbr = cleaned
    .replace(/\bcreek\b/gi, "C")
    .replace(/\briver\b/gi, "R")
    .replace(/\breservoir\b/gi, "Res");
  const mc = cleaned.replace(/\bMc([A-Za-z])/g, "Mc $1");
  const core = tokens(cleaned)
    .filter((t) => !GENERIC.has(t))
    .join(" ");
  return [...new Set([cleaned, stripped, abbr, mc, core].filter((q) => q.length >= 4))].slice(0, 5);
}

/** Main name plus parenthetical / slash phrases — those often hold the water. */
export function phrases(water) {
  const raw = String(water ?? "");
  const parens = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const main = raw.replace(/\([^)]*\)/g, " ");
  const bits = [main, ...parens].flatMap((p) => p.split(/[/+]|\s*[—]\s*|\s+–\s+|\band\b/));
  return [...new Set(bits.map(norm).filter((p) => p.length > 2))];
}

export function reachTokens(water) {
  const raw = String(water ?? "");
  const parens = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const dashes = raw.split(/[—–]/).slice(1);
  const out = new Set();
  for (const p of [...parens, ...dashes]) {
    for (const t of tokens(p)) {
      if (!GENERIC.has(t) && !GENERIC_GEO.has(t) && t !== "reach" && t !== "branch") {
        out.add(t);
      }
    }
  }
  return [...out];
}

export function typeAligned(waterType, stationName) {
  const hint = TYPE_HINT[waterType];
  if (!hint) return true;
  return hint.test(norm(stationName));
}

function isModifierToken(t) {
  return new RegExp(`^(?:${MODIFIER})$`).test(t);
}

/** Station identity is the clause before near/at/above/below. */
export function stationSubject(station) {
  const s = norm(station);
  const cut = s.split(/\b(?:near|at|above|below|nr|by|blw|abv|ab|a)\b/)[0].trim();
  return cut || s;
}

function primaryFeature(station) {
  const s = stationSubject(station);
  const lakeFirst = s.match(
    /^(?:(?:little|east|west|north|south|big|upper|lower|middle)\s+)?(?:lake|lac|lk|reservoir|res|bay|sound|pond|harbor|harbour)(?:\s+of(?:\s+the)?)?\s+[a-z0-9]+/,
  );
  if (lakeFirst) return lakeFirst[0];
  const nameFirst = s.match(
    /^[a-z0-9]+(?:\s+[a-z0-9]+)?\s+(?:lake|lac|lk|reservoir|res|bay|sound|pond|harbor|harbour)/,
  );
  if (nameFirst) return nameFirst[0];
  return s;
}

function waterCore(phrase) {
  const reachCut = phrase.split(/\b(?:below|above|blw|between)\b/)[0].trim();
  const ofParts = reachCut.split(/\bof the\b/);
  if (ofParts.length > 1) {
    const left = tokens(ofParts[0]).filter((t) => !GENERIC.has(t) && !isModifierToken(t));
    if (left.length >= 1) return ofParts[0].trim();
  }
  return reachCut || phrase;
}

/**
 * Score a station name against a published water name.
 * Returns 0 when the phrase or type cannot be defended.
 */
export function nameScore(water, station, opts = {}) {
  const s = norm(station);
  const subject = stationSubject(station);
  const foldedSubject = subject.replace(/ /g, "");
  if (!s) return 0;
  let best = 0;
  const allPhrases = phrases(water);
  for (let i = 0; i < allPhrases.length; i += 1) {
    const phrase = allPhrases[i];
    const core = waterCore(phrase);
    const toks = tokens(core);
    const typeWord = toks.find((t) => GENERIC.has(t));
    if (i > 0 && !typeWord) continue;
    const marinePhrase = Boolean(typeWord && MARINE_FAMILY.has(typeWord));

    let distinctive = toks.filter((t) => !GENERIC.has(t));
    const nonGeo = distinctive.filter((t) => !GENERIC_GEO.has(t));
    // "Lake Michigan" — the geo word IS the name. Only drop geo tokens
    // when another distinctive word remains.
    distinctive = nonGeo.length ? nonGeo : distinctive;
    if (marinePhrase) {
      distinctive = distinctive.filter((t) => !isModifierToken(t));
    }
    if (distinctive.length === 0) continue;

    const wordHit = distinctive.every((t) => new RegExp(`\\b${t}\\b`).test(subject));
    const joined = distinctive.join("");
    const foldedHit = joined.length >= 8 && foldedSubject.includes(joined);
    if (!wordHit && !foldedHit) continue;
    if (/\btrib(?:utary)?\b/.test(subject)) continue;

    const lead = primaryFeature(station);
    if (
      !distinctive.every(
        (t) =>
          new RegExp(`\\b${t}\\b`).test(lead) ||
          (joined.length >= 8 && lead.replace(/ /g, "").includes(joined)),
      )
    ) {
      continue;
    }
    if (typeWord && LAKE_FAMILY.has(typeWord) && !opts.relaxType) {
      if (![...LAKE_FAMILY].some((w) => new RegExp(`\\b${w}\\b`).test(lead))) continue;
    }

    if (typeWord && !opts.relaxType) {
      const stationHasType = LAKE_FAMILY.has(typeWord)
        ? [...LAKE_FAMILY].some((w) => new RegExp(`\\b${w}\\b`).test(s))
        : typeWord === "river" || typeWord === "creek"
          ? /\b(?:river|riviere|r|rv|creek|c|fork|stream|brook|slough|canal)\b/.test(s)
          : new RegExp(`\\b${typeWord}\\b`).test(s);
      if (!stationHasType) continue;
    }

    const head = distinctive[0];
    const stationHasMod =
      new RegExp(`\\b(?:${MODIFIER})\\s+${head}\\b`).test(subject) ||
      new RegExp(`\\b(?:${MODIFIER})\\s+lake\\s+${head}\\b`).test(subject);
    const waterHasMod =
      new RegExp(`\\b(?:${MODIFIER})\\s+${head}\\b`).test(core) ||
      new RegExp(`\\b(?:${MODIFIER})\\s+lake\\s+${head}\\b`).test(core);
    if (stationHasMod && !waterHasMod) continue;

    const phraseHit = subject.includes(core) || s.includes(core) || foldedHit ? 0.2 : 0;
    const weighted = Math.min(1, 0.75 + 0.05 * distinctive.length + phraseHit);
    if (weighted > best) best = weighted;
  }
  return best;
}

export function bestMatches(water, waterType, sites, floor = 0.75, opts = {}) {
  const hits = [];
  for (const row of sites) {
    if (waterType && !opts.skipType && !typeAligned(waterType, row.name)) continue;
    const score = nameScore(water, row.name, opts);
    if (score >= floor) hits.push({ row, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

const REACH_NOISE = new Set([
  "waters",
  "shoreline",
  "frontage",
  "basin",
  "reach",
  "western",
  "eastern",
  "northern",
  "southern",
  "tidal",
  "utah",
  "wyoming",
  "nevada",
  "arizona",
  "michigan",
  "indiana",
  "illinois",
  "wisconsin",
  "minnesota",
  "ohio",
  "vermont",
  "kentucky",
  "dakota",
  "california",
  "oregon",
  "washington",
  "colorado",
  "texas",
  "florida",
]);

/** Pick one hit. Prefer the published water name, then a named reach. Same-water multi-reach is disclosed. */
export function pickUnique(water, hits) {
  if (hits.length === 0) return null;
  const top = hits[0].score;
  let pool = hits.filter((h) => Math.abs(h.score - top) < 0.001);
  const primary = phrases(water)[0] ?? "";
  const primaryToks = tokens(waterCore(primary)).filter(
    (t) => !GENERIC.has(t) && !GENERIC_GEO.has(t),
  );
  if (primaryToks.length && pool.length > 1) {
    const narrowed = pool.filter((h) => {
      const sub = stationSubject(h.row.name);
      return primaryToks.every((t) => new RegExp(`\\b${t}\\b`).test(sub));
    });
    if (narrowed.length >= 1) pool = narrowed;
  }
  const reach = reachTokens(water);
  if (reach.length && pool.length > 1) {
    const narrowed = pool.filter((h) => {
      const s = norm(h.row.name);
      return reach.some((t) => new RegExp(`\\b${t}\\b`).test(s));
    });
    if (narrowed.length >= 1) pool = narrowed;
  }
  const requiredReach = String(water ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[—–]/)
    .slice(1)
    .flatMap((p) =>
      tokens(p).filter(
        (t) => !GENERIC.has(t) && !GENERIC_GEO.has(t) && !isModifierToken(t) && !REACH_NOISE.has(t),
      ),
    );
  if (requiredReach.length) {
    const narrowed = pool.filter((h) => {
      const s = norm(h.row.name);
      return requiredReach.some((t) => new RegExp(`\\b${t}\\b`).test(s));
    });
    if (narrowed.length >= 1) pool = narrowed;
    else return null;
  }
  pool.sort((a, b) => String(a.row.id).localeCompare(String(b.row.id)));
  const picked = pool[0];
  return {
    ...picked,
    alternateCount: pool.length,
    alternates: pool.slice(0, 5).map((h) => `${h.row.id} ${h.row.name}`),
  };
}
