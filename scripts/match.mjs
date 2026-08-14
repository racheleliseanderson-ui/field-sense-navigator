/**
 * Fail-closed name matching shared by USGS / NOAA / WSC resolvers.
 * Phrase + water-type must align. A modifier prefix (LITTLE BOW vs BOW)
 * is a miss. Ties are the caller's problem — they must not pick a neighbor.
 */

export const STOP = new Set([
  "the",
  "of",
  "waters",
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
  "lac",
  "creek",
  "reservoir",
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
]);

export const TYPE_HINT = {
  lake: /\blake\b|\blk\b|\blac\b|\bpond\b|\breservoir\b/,
  reservoir: /\breservoir\b|\blake\b|\blac\b|\bres\b/,
  river: /\briver\b|\briviere\b|\brivière\b|\bcreek\b|\bfork\b|\bstream\b|\bcanal\b|\bbrook\b|\bslough\b/,
  marine: /\bbay\b|\binlet\b|\bsound\b|\bharbor\b|\bharbour\b|\bgulf\b|\bocean\b|\btide\b|\blagoon\b|\bpass\b|\bchannel\b|\bstrait\b/,
};

const MODIFIER = "little|north|south|east|west|big|petite|petit|lower|upper";

export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function tokens(water) {
  return norm(water)
    .split(" ")
    .filter((x) => x.length > 2 && !STOP.has(x));
}

/** Main name plus parenthetical / slash phrases — those often hold the water. */
export function phrases(water) {
  const raw = String(water ?? "");
  const parens = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const main = raw.replace(/\([^)]*\)/g, " ");
  const bits = [main, ...parens].flatMap((p) => p.split(/[/—–]+/));
  return [...new Set(bits.map(norm).filter((p) => p.length > 2))];
}

export function reachTokens(water) {
  const raw = String(water ?? "");
  const parens = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const out = new Set();
  for (const p of parens) {
    for (const t of tokens(p)) {
      if (!GENERIC.has(t) && t !== "reach" && t !== "branch" && t !== "lower" && t !== "upper") {
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

/**
 * Score a station name against a published water name.
 * Returns 0 when the phrase or type cannot be defended.
 */
/** Station identity is the clause before near/at/above/below. */
export function stationSubject(station) {
  const s = norm(station);
  const cut = s.split(/\b(?:near|at|above|below|nr|by)\b/)[0].trim();
  return cut || s;
}

export function nameScore(water, station) {
  const s = norm(station);
  const subject = stationSubject(station);
  if (!s) return 0;
  let best = 0;
  for (const phrase of phrases(water)) {
    const toks = tokens(phrase);
    const distinctive = toks.filter((t) => !GENERIC.has(t) && !GENERIC_GEO.has(t));
    if (distinctive.length === 0) continue;
    // A match that only lives in the location clause (QUINSAM near CAMPBELL RIVER)
    // is not this water.
    if (!distinctive.every((t) => new RegExp(`\\b${t}\\b`).test(subject))) continue;
    const typeWord = toks.find((t) => GENERIC.has(t));
    if (typeWord && !new RegExp(`\\b${typeWord}\\b`).test(s)) continue;
    const head = distinctive[0];
    const stationHasMod = new RegExp(`\\b(?:${MODIFIER})\\s+${head}\\b`).test(subject);
    const waterHasMod = new RegExp(`\\b(?:${MODIFIER})\\s+${head}\\b`).test(phrase);
    if (stationHasMod && !waterHasMod) continue;
    const phraseHit = subject.includes(phrase) || s.includes(phrase) ? 0.2 : 0;
    const weighted = Math.min(1, 0.75 + 0.05 * distinctive.length + phraseHit);
    if (weighted > best) best = weighted;
  }
  return best;
}

export function bestMatches(water, waterType, sites, floor = 0.75) {
  const hits = [];
  for (const row of sites) {
    if (waterType && !typeAligned(waterType, row.name)) continue;
    const score = nameScore(water, row.name);
    if (score >= floor) hits.push({ row, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/** Pick one hit. Same-water multi-reach is disclosed, not rejected. Different waters never share a phrase. */
export function pickUnique(water, hits) {
  if (hits.length === 0) return null;
  const top = hits[0].score;
  let pool = hits.filter((h) => Math.abs(h.score - top) < 0.001);
  const reach = reachTokens(water);
  if (reach.length && pool.length > 1) {
    const narrowed = pool.filter((h) => {
      const s = norm(h.row.name);
      return reach.some((t) => new RegExp(`\\b${t}\\b`).test(s));
    });
    if (narrowed.length >= 1) pool = narrowed;
  }
  pool.sort((a, b) => String(a.row.id).localeCompare(String(b.row.id)));
  const picked = pool[0];
  return {
    ...picked,
    alternateCount: pool.length,
    alternates: pool.slice(0, 5).map((h) => `${h.row.id} ${h.row.name}`),
  };
}
