import { destinations, displayName, isProvince, type Destination } from "@/lib/catalog";

/** Facets a plain-text query can resolve into on its own. */
export interface Token {
  kind: "state" | "type" | "species" | "access" | "tag" | "text";
  value: string;
  label: string;
}

export interface Hit {
  destination: Destination;
  score: number;
  matched: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STATE_ABBR: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming",
};

/** Canadian provinces and territories, by postal code. No code collides with a state. */
const PROVINCE_ABBR: Record<string, string> = {
  ab: "Alberta", bc: "British Columbia", mb: "Manitoba", nb: "New Brunswick",
  nl: "Newfoundland and Labrador", nt: "Northwest Territories", ns: "Nova Scotia",
  nu: "Nunavut", on: "Ontario", pe: "Prince Edward Island", qc: "Quebec",
  sk: "Saskatchewan", yt: "Yukon",
};

const REGION_ABBR: Record<string, string> = { ...STATE_ABBR, ...PROVINCE_ABBR };

const TYPE_WORDS: Record<string, string> = {
  lake: "lake", lakes: "lake", lago: "lake",
  reservoir: "reservoir", reservoirs: "reservoir", embalse: "reservoir",
  river: "river", rivers: "river", creek: "river", rio: "river",
  marine: "marine", saltwater: "marine", coast: "marine", coastal: "marine",
  bay: "marine", surf: "marine", ocean: "marine",
};

const ACCESS_WORDS: Record<string, string> = {
  kayak: "hand launch", canoe: "hand launch", paddle: "hand launch",
  "hand launch": "hand launch", carry: "hand launch",
  ramp: "boat launch", launch: "boat launch", trailer: "boat launch",
  boat: "boat launch", pier: "pier", dock: "pier", jetty: "pier",
  bank: "shore", shore: "shore", wade: "shore", wading: "shore",
};

/**
 * Catalog access types are agency phrases, not user words. Each canonical
 * facet lists the published access strings that honestly satisfy it.
 */
const ACCESS_MATCH: Record<string, string[]> = {
  "hand launch": [
    "hand launch",
    "small craft",
    "shore and walk in",
    "trail access",
    "float access",
    "park access",
    "boat launch",
    "multiple official access",
  ],
  "boat launch": ["boat launch", "boating", "multiple official access", "float access"],
  pier: ["pier", "dock", "park access", "multiple official access"],
  shore: [
    "shore",
    "walk in",
    "trail access",
    "park access",
    "multiple official access",
  ],
};

/**
 * Land-manager and anatomy tags that are not already type/access words.
 * "pier" / "ramp" stay access tokens; these catch state park, NPS, USFS, BLM.
 */
const TAG_WORDS: Record<string, string> = {
  "state park": "state_park",
  "national park": "national_park",
  "national forest": "national_forest",
  blm: "blm",
  usbr: "usbr",
  reclamation: "usbr",
  usace: "usace",
};

/** Every distinct species term in the catalog, for facet detection. */
const speciesTerms = (() => {
  const set = new Set<string>();
  for (const d of destinations) for (const s of d.speciesContext) set.add(norm(s));
  return set;
})();

interface Row {
  d: Destination;
  name: string;
  state: string;
  region: string;
  county: string;
  type: string;
  species: string;
  access: string;
  tags: string;
  blob: string;
}

const index: Row[] = destinations.map((d) => {
  const name = norm(displayName(d));
  const state = norm(d.state);
  const region = norm(d.region);
  const county = norm(d.county ?? "");
  const type = norm(d.waterType);
  const species = norm(d.speciesContext.join(" "));
  const access = norm(d.publicAccess.map((a) => `${a.name} ${a.type}`).join(" "));
  const tags = norm((d.tags ?? []).join(" ").replace(/_/g, " "));
  return {
    d, name, state, region, county, type, species, access, tags,
    blob: [name, state, region, county, type, species, access, tags, norm(d.managingAgency ?? "")].join(" "),
  };
});

/** Damerau-lite edit distance, capped — enough for one-key typos. */
function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 4) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Pull facets out of free text: "kayak texas", "trout river", "pier access". */
export function tokenize(query: string): { tokens: Token[]; rest: string } {
  const words = norm(query).split(" ").filter(Boolean);
  const tokens: Token[] = [];
  const rest: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const two = i + 1 < words.length ? `${w} ${words[i + 1]}` : "";

    const three =
      i + 2 < words.length ? `${w} ${words[i + 1]} ${words[i + 2]}` : "";
    const stateThree = three && Object.values(REGION_ABBR).find((s) => norm(s) === three);
    if (stateThree) {
      tokens.push({ kind: "state", value: stateThree, label: stateThree });
      i += 2;
      continue;
    }
    const stateTwo = two && Object.values(REGION_ABBR).find((s) => norm(s) === two);
    if (stateTwo) { tokens.push({ kind: "state", value: stateTwo, label: stateTwo }); i++; continue; }
    const stateOne = Object.values(REGION_ABBR).find((s) => norm(s) === w);
    if (stateOne) { tokens.push({ kind: "state", value: stateOne, label: stateOne }); continue; }
    if (REGION_ABBR[w] && w.length === 2) {
      const full = REGION_ABBR[w]!;
      tokens.push({ kind: "state", value: full, label: full });
      continue;
    }
    if (two && ACCESS_WORDS[two]) {
      tokens.push({ kind: "access", value: ACCESS_WORDS[two]!, label: two });
      i++; continue;
    }
    if (two && TAG_WORDS[two]) {
      tokens.push({ kind: "tag", value: TAG_WORDS[two]!, label: two });
      i++; continue;
    }
    if (TYPE_WORDS[w]) { tokens.push({ kind: "type", value: TYPE_WORDS[w]!, label: w }); continue; }
    if (ACCESS_WORDS[w]) { tokens.push({ kind: "access", value: ACCESS_WORDS[w]!, label: w }); continue; }
    if (TAG_WORDS[w]) { tokens.push({ kind: "tag", value: TAG_WORDS[w]!, label: w }); continue; }
    if (speciesTerms.has(w) || [...speciesTerms].some((s) => s.includes(w) && w.length > 3)) {
      tokens.push({ kind: "species", value: w, label: w });
      continue;
    }
    rest.push(w);
  }

  return { tokens, rest: rest.join(" ") };
}

function scoreRow(row: Row, terms: string[], tokens: Token[]): Hit | null {
  let score = 0;
  const matched: string[] = [];

  for (const t of tokens) {
    if (t.kind === "state") {
      if (norm(t.value) !== row.state) return null;
      score += 30; matched.push(t.value);
    } else if (t.kind === "type") {
      if (t.value !== row.type) return null;
      score += 24; matched.push(t.value);
    } else if (t.kind === "species") {
      if (!row.species.includes(t.value)) return null;
      score += 26; matched.push(t.value);
    } else if (t.kind === "access") {
      const needles = ACCESS_MATCH[t.value] ?? [t.value];
      if (!needles.some((n) => row.access.includes(n))) return null;
      score += 22; matched.push(t.value);
    } else if (t.kind === "tag") {
      if (!row.d.tags?.includes(t.value)) return null;
      score += 22; matched.push(t.label);
    }
  }

  for (const term of terms) {
    if (row.name.startsWith(term)) { score += 60; matched.push(term); continue; }
    if (row.name.includes(term)) { score += 44; matched.push(term); continue; }
    if (row.county.includes(term)) { score += 24; matched.push(term); continue; }
    if (row.region.includes(term)) { score += 22; matched.push(term); continue; }
    if (row.state.includes(term)) { score += 20; matched.push(term); continue; }
    if (row.species.includes(term)) { score += 18; matched.push(term); continue; }
    if (row.access.includes(term)) { score += 14; matched.push(term); continue; }
    if (row.tags.includes(term)) { score += 16; matched.push(term); continue; }
    if (row.blob.split(" ").some((w) => close(w, term))) { score += 8; matched.push(term); continue; }
    return null;
  }

  if (score === 0 && tokens.length === 0 && terms.length === 0) score = 1;
  return score > 0 ? { destination: row.d, score, matched } : null;
}

export interface SearchResult {
  hits: Hit[];
  tokens: Token[];
  /** Nearest workable query when nothing matched exactly. */
  suggestion: string | null;
}

export function search(query: string): SearchResult {
  const { tokens, rest } = tokenize(query);
  const terms = rest.split(" ").filter(Boolean);

  if (tokens.length === 0 && terms.length === 0) {
    return { hits: index.map((r) => ({ destination: r.d, score: 0, matched: [] })), tokens, suggestion: null };
  }

  const hits: Hit[] = [];
  for (const row of index) {
    const hit = scoreRow(row, terms, tokens);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score);

  let suggestion: string | null = null;
  if (hits.length === 0 && terms.length > 0) {
    const target = terms[0]!;
    let best: { word: string; d: number } | null = null;
    for (const row of index) {
      for (const w of row.name.split(" ")) {
        if (w.length < 4) continue;
        const d = Math.abs(w.length - target.length) + (w.startsWith(target.slice(0, 3)) ? 0 : 3);
        if (!best || d < best.d) best = { word: w, d };
      }
    }
    if (best && best.d <= 3) suggestion = best.word;
  }

  return { hits, tokens, suggestion };
}

export interface Suggestion {
  kind: "water" | "state" | "species";
  label: string;
  sub?: string;
  id?: string;
}

/** Instant suggestions grouped by water, state and species. */
export function suggest(query: string, limit = 8): Suggestion[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const out: Suggestion[] = [];

  for (const row of index) {
    if (out.length >= limit) break;
    if (row.name.includes(q)) {
      out.push({
        kind: "water",
        label: displayName(row.d),
        sub: `${row.d.region} · ${row.d.state}`,
        id: row.d.id,
      });
    }
  }

  const seenState = new Set<string>();
  for (const row of index) {
    if (out.length >= limit + 3) break;
    if (row.state.includes(q) && !seenState.has(row.d.state)) {
      seenState.add(row.d.state);
      out.push({
        kind: "state",
        label: row.d.state,
        sub: isProvince(row.d.state) ? "Province or territory" : "State",
      });
    }
  }

  const seenSpecies = new Set<string>();
  for (const row of index) {
    if (out.length >= limit + 6) break;
    for (const s of row.d.speciesContext) {
      if (norm(s).includes(q) && !seenSpecies.has(s)) {
        seenSpecies.add(s);
        out.push({ kind: "species", label: s, sub: "Species" });
      }
    }
  }

  return out.slice(0, limit + 4);
}

/* ---------- advanced facets ---------- */

/** Canonical access facets a reader can filter on directly. */
export const ACCESS_FACETS = [
  { id: "boat launch", label: "Trailer launch" },
  { id: "hand launch", label: "Hand launch" },
  { id: "pier", label: "Pier or dock" },
  { id: "shore", label: "Shore or walk-in" },
] as const;

/**
 * Catalog tags derived from documented access anatomy and land-manager class.
 * Distinct from ACCESS_FACETS: these match `tags[]`, not the access-phrase blob.
 */
export const TAG_FACETS = [
  { id: "pier", label: "Pier" },
  { id: "boat_ramp", label: "Boat ramp" },
  { id: "shore_access", label: "Shore access" },
  { id: "state_park", label: "State park" },
  { id: "national_park", label: "National park" },
  { id: "national_forest", label: "National forest" },
] as const;

/** Species that appear on more than one water, ordered by how widely they occur. */
export const speciesList: string[] = (() => {
  const count = new Map<string, number>();
  for (const d of destinations)
    for (const s of d.speciesContext) count.set(s, (count.get(s) ?? 0) + 1);
  return [...count.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s);
})();

export function matchesAccess(d: Destination, facet: string): boolean {
  const needles = ACCESS_MATCH[facet] ?? [facet];
  const blob = norm(d.publicAccess.map((a) => `${a.name} ${a.type}`).join(" "));
  return needles.some((n) => blob.includes(n));
}

export function matchesSpecies(d: Destination, species: string): boolean {
  const target = norm(species);
  return d.speciesContext.some((s) => norm(s) === target);
}

export function matchesTag(d: Destination, tag: string): boolean {
  return (d.tags ?? []).includes(tag);
}
