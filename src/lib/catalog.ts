import base from "@/data/destinations.json";
import bcInterior from "@/data/destinations/bc-interior.json";
import seasonWindowsEnrichment from "@/data/enrichments/season-windows.json";
import alaskaSeasonWindowsEnrichment from "@/data/enrichments/alaska-season-windows.json";
import jurisdictionRules from "@/data/enrichments/jurisdiction-rules.json";
import levelCompleteIndex from "@/data/enrichments/level-complete-index.json";

export type WaterType = "lake" | "reservoir" | "river" | "marine";

export interface AccessPoint {
  name: string;
  type: string;
  status?: string;
  officiallyPublished?: boolean;
  amenities?: string[];
}

export interface SeasonWindow {
  label: string;
  start?: string;
  end?: string;
  notes?: string;
}

/** Explicit relationship to another catalog record. Additive only. */
export interface RelatedWater {
  id: string;
  relation:
    | "same_waterbody_segment"
    | "adjacent_public_corridor"
    | "shared_agency_page"
    | "parent"
    | "child";
}

export interface Destination {
  id: string;
  state: string;
  /**
   * The sub-state place name, where the source gives one.
   *
   * Null on roughly half the catalogue, and it was typed as a plain string
   * for all of them. `norm(d.region)` then threw on the first record without
   * one, which took out the search index — and with it /explore and every
   * other page that builds it. Typed honestly, the compiler finds all
   * seventeen places that assumed it was there.
   */
  region: string | null;
  county?: string;
  waterbody: string;
  accessSite?: string;
  waterType: WaterType;
  officialSourceUrl: string;
  checkedAt: string;
  nextReviewAt: string;
  status: string;
  speciesContext: string[];
  publicAccess: AccessPoint[];
  currentNotices: string[];
  directVerification: string[];
  privacy: {
    classification: string;
    publicLocationIncluded: boolean;
    sensitiveLocationIncluded: boolean;
  };
  usgsSiteId?: string | null;
  noaaCoopsStationId?: string | null;
  ndbcBuoyId?: string | null;
  managingAgency?: string | null;
  officialRegsUrl?: string | null;
  regsReviewedDate?: string | null;
  accessReviewedDate?: string | null;
  lastVerified?: string | null;
  speciesPresent?: string[] | null;
  seasonWindows?: SeasonWindow[] | null;
  tags?: string[] | null;
  related?: RelatedWater[] | null;
  lastHumanReviewedAt?: string | null;
  lastHumanReviewedBy?: string | null;
  provenanceNotes?: string | null;
  confidenceNotes?: string | null;
  unresolvedQuestions?: string[] | null;
}

/** Partial Destination written by bench enrichment; applied by id after load. */
export type DestinationEnrichment = Partial<Destination> & { id: string };

export const SCHEMA_VERSION = "0.6.0";

function applyEnrichments(
  records: Destination[],
  enrichments: DestinationEnrichment[],
): Destination[] {
  if (!enrichments.length) return records;
  const byId = new Map(enrichments.map((e) => [e.id, e]));
  return records.map((r) => {
    const e = byId.get(r.id);
    if (!e) return r;
    const { id: _id, ...fields } = e;
    return { ...r, ...fields };
  });
}

const assembled: Destination[] = [...(base as Destination[]), ...(bcInterior as Destination[])];

type SeasonRule = Omit<DestinationEnrichment, "id">;
type RuleIndexRow = { id: string; rule: string };

function expandLevelComplete(): DestinationEnrichment[] {
  const rules = jurisdictionRules as Record<string, SeasonRule>;
  const rows = levelCompleteIndex as RuleIndexRow[];
  return rows.map(({ id, rule }) => {
    const r = rules[rule];
    return r ? { id, ...r } : { id };
  });
}

const allSeasonWindowEnrichments: DestinationEnrichment[] = [
  ...(seasonWindowsEnrichment as DestinationEnrichment[]),
  ...(alaskaSeasonWindowsEnrichment as DestinationEnrichment[]),
  ...expandLevelComplete(),
];

/* ------------------------------------------------------------------ *
 * Review scheduling
 *
 * The enrichment layer used to stamp every record with the same
 * nextReviewAt. That is a scheduling artefact, not a fact about any
 * water: it meant the whole catalog fell due in the same minute and
 * every page in the instrument would read "review due" on one morning,
 * which is the same as none of them saying it.
 *
 * A review date is now derived from the record's own last source check
 * plus a deterministic offset, so the queue arrives at a workable rate
 * and no record's date implies a check that did not happen. The offset
 * is a hash of the id — stable across renders, servers and builds, so
 * the server and the client always agree, and a record keeps its slot
 * between deploys.
 *
 * One thing this date is NOT: a commitment anybody made. It is
 * `checkedAt` plus a cadence plus a spread, and printing it bare as
 * "Next review 2026-11-14" reads to a reader as an appointment in
 * somebody's calendar. That is a stronger claim than the number can
 * carry, and this instrument's whole argument is that it does not make
 * claims it cannot support. So `reviewScheduleNote` exists, and every
 * surface that prints the date is expected to say what kind of date it
 * is at least once on the page.
 * ------------------------------------------------------------------ */

/** Days after a source check that a record is due to be read again. */
export const REVIEW_CADENCE_DAYS = 40;
/** Width of the deterministic spread, in days. */
export const REVIEW_SPREAD_DAYS = 30;

/** FNV-1a over the id. Deterministic everywhere; never random. */
function reviewOffset(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % REVIEW_SPREAD_DAYS;
}

/** The day this record is next due to be read, as YYYY-MM-DD. */
export function scheduleReview(d: Destination): string {
  const checked = printedDay(d.checkedAt);
  if (Number.isNaN(checked)) return d.nextReviewAt;
  const due = checked + (REVIEW_CADENCE_DAYS + reviewOffset(d.id)) * 86_400_000;
  return new Date(due).toISOString().slice(0, 10);
}

export const destinations = applyEnrichments(assembled, allSeasonWindowEnrichments).map((d) => ({
  ...d,
  nextReviewAt: scheduleReview(d),
}));

export const NAMED_WATER_COUNT = destinations.length;

export const destinationById = (id: string) => destinations.find((d) => d.id === id);

export const RELATION_LABEL: Record<RelatedWater["relation"], string> = {
  same_waterbody_segment: "Same waterbody",
  adjacent_public_corridor: "Adjacent public corridor",
  shared_agency_page: "Shared agency page",
  parent: "Parent water",
  child: "Child / access site",
};

export function relatedRecords(d: Destination) {
  return (d.related ?? [])
    .map((rel) => {
      const destination = destinationById(rel.id);
      return destination ? { ...rel, destination } : null;
    })
    .filter((row): row is RelatedWater & { destination: Destination } => row !== null);
}

export const states = [...new Set(destinations.map((d) => d.state))].sort();

export const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
] as const;

const PROVINCE_SET: ReadonlySet<string> = new Set(PROVINCES);

export type Jurisdiction = "us" | "ca";

export const isProvince = (state: string) => PROVINCE_SET.has(state);

export const jurisdictionOf = (d: Destination): Jurisdiction => (isProvince(d.state) ? "ca" : "us");

export const provinces = states.filter(isProvince);

export const usStates = states.filter((s) => !isProvince(s));

/**
 * Jurisdiction postal codes — the single source of truth for both search
 * ("tx", "bc") and the coverage map. No provincial code collides with a state
 * code, so one lookup covers North America.
 */
export const STATE_ABBR: Readonly<Record<string, string>> = {
  al: "Alabama",
  ak: "Alaska",
  az: "Arizona",
  ar: "Arkansas",
  ca: "California",
  co: "Colorado",
  ct: "Connecticut",
  de: "Delaware",
  fl: "Florida",
  ga: "Georgia",
  hi: "Hawaii",
  id: "Idaho",
  il: "Illinois",
  in: "Indiana",
  ia: "Iowa",
  ks: "Kansas",
  ky: "Kentucky",
  la: "Louisiana",
  me: "Maine",
  md: "Maryland",
  ma: "Massachusetts",
  mi: "Michigan",
  mn: "Minnesota",
  ms: "Mississippi",
  mo: "Missouri",
  mt: "Montana",
  ne: "Nebraska",
  nv: "Nevada",
  nh: "New Hampshire",
  nj: "New Jersey",
  nm: "New Mexico",
  ny: "New York",
  nc: "North Carolina",
  nd: "North Dakota",
  oh: "Ohio",
  ok: "Oklahoma",
  or: "Oregon",
  pa: "Pennsylvania",
  ri: "Rhode Island",
  sc: "South Carolina",
  sd: "South Dakota",
  tn: "Tennessee",
  tx: "Texas",
  ut: "Utah",
  vt: "Vermont",
  va: "Virginia",
  wa: "Washington",
  wv: "West Virginia",
  wi: "Wisconsin",
  wy: "Wyoming",
};

export const PROVINCE_ABBR: Readonly<Record<string, string>> = {
  ab: "Alberta",
  bc: "British Columbia",
  mb: "Manitoba",
  nb: "New Brunswick",
  nl: "Newfoundland and Labrador",
  nt: "Northwest Territories",
  ns: "Nova Scotia",
  nu: "Nunavut",
  on: "Ontario",
  pe: "Prince Edward Island",
  qc: "Quebec",
  sk: "Saskatchewan",
  yt: "Yukon",
};

export const REGION_ABBR: Readonly<Record<string, string>> = {
  ...STATE_ABBR,
  ...PROVINCE_ABBR,
};

const ABBR_BY_NAME: ReadonlyMap<string, string> = new Map(
  Object.entries(REGION_ABBR).map(([code, name]) => [name, code.toUpperCase()]),
);

/** "Texas" -> "TX". Falls back to the first two letters for an unlisted name. */
export const abbrFor = (name: string) => ABBR_BY_NAME.get(name) ?? name.slice(0, 2).toUpperCase();

/** How many catalog records each jurisdiction holds. */
export const countByState: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const d of destinations) m.set(d.state, (m.get(d.state) ?? 0) + 1);
  return m;
})();

export const waterTypes: WaterType[] = ["lake", "reservoir", "river", "marine"];

export const humanize = (value: string) => value.replace(/_/g, " ").replace(/\s+/g, " ").trim();

export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function catalogTags(d: Destination): string[] {
  return [...(d.tags ?? [])].sort();
}

export function tagLabel(tag: string): string {
  const known: Record<string, string> = {
    lake: "Lake",
    reservoir: "Reservoir",
    river: "River",
    marine: "Marine",
    pier: "Pier",
    boat_ramp: "Boat ramp",
    shore_access: "Shore access",
    state_park: "State park",
    national_park: "National park",
    national_forest: "National forest",
    blm: "BLM",
    usbr: "Bureau of Reclamation",
    usace: "Army Corps",
  };
  return known[tag] ?? titleCase(humanize(tag));
}

/** Dated harvest closures (MM-DD). Empty array is a completed check, not a gap. */
export function datedWindows(d: Destination): SeasonWindow[] {
  return (d.seasonWindows ?? []).filter((w) => Boolean(w.start && w.end));
}

export function windowSpan(w: SeasonWindow): string | null {
  if (!w.start || !w.end) return null;
  return `${w.start} → ${w.end}`;
}

export const displayName = (d: Destination) =>
  d.accessSite ? `${d.waterbody} — ${d.accessSite}` : d.waterbody;

function printedDay(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcToday(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function daysSince(iso: string, now = new Date()): number {
  const then = printedDay(iso);
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.round((utcToday(now) - then) / 86_400_000));
}

/**
 * What the review date actually means, in one sentence.
 *
 * Say it wherever the date is printed. A reader who sees a precise day and
 * no explanation will assume somebody scheduled it, and then read an overdue
 * flag as a person having missed a deadline rather than as a cadence lapsing.
 */
export function reviewScheduleNote(): string {
  return `A target, not an appointment: ${REVIEW_CADENCE_DAYS} days after this record's last source check, spread across ${REVIEW_SPREAD_DAYS} days so the whole catalog does not fall due on one morning.`;
}

/**
 * "Region, State", with the region left out when the source never gave one.
 *
 * Half this catalogue has no sub-state place name. Printing "null · Montana"
 * or a bare leading separator is worse than printing the state on its own,
 * and worse still is a crash.
 */
export function placeOf(d: Destination): string {
  return d.region ? `${d.region}, ${d.state}` : d.state;
}

/** The same, with the middot separator the cards use. */
export function placeDotted(d: Destination): string {
  return d.region ? `${d.region} · ${d.state}` : d.state;
}

export function reviewOverdue(d: Destination, now = new Date()): boolean {
  const due = printedDay(d.nextReviewAt);
  if (Number.isNaN(due)) return false;
  return utcToday(now) > due;
}
