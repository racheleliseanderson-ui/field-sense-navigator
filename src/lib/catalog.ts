import base from "@/data/destinations.json";
import bcInterior from "@/data/destinations/bc-interior.json";
import seasonWindowsEnrichment from "@/data/enrichments/season-windows.json";

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
  region: string;
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
  /** Optional controlled tags (accessClass, hazardFamily, etc.). Derived tags still live in readTags(). */
  tags?: string[] | null;
  /** Optional explicit links to related catalog records. */
  related?: RelatedWater[] | null;

  /**
   * Lightweight provenance & human-review metadata (schema 0.6.0+).
   * All optional so existing records remain valid.
   * Populate only with high-confidence, source-backed information.
   */
  lastHumanReviewedAt?: string | null;
  lastHumanReviewedBy?: string | null;
  provenanceNotes?: string | null;
  confidenceNotes?: string | null;
  unresolvedQuestions?: string[] | null;
}

/** Partial Destination written by bench enrichment; applied by id after load. */
export type DestinationEnrichment = Partial<Destination> & { id: string };

export const SCHEMA_VERSION = "0.6.0";

/**
 * Catalog is the concatenation of the base file plus jurisdiction shards,
 * then field-level enrichments committed under src/data/enrichments/.
 * See AGENTS.project.md Scale section.
 *
 * Bench rule: one fully built waterbody (or one official-source family) per
 * enrichment entry. No partial stacks. Official page must have been read.
 */
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

const assembled: Destination[] = [
  ...(base as Destination[]),
  ...(bcInterior as Destination[]),
];

export const destinations = applyEnrichments(
  assembled,
  seasonWindowsEnrichment as DestinationEnrichment[],
);

/** Single source of truth for every displayed catalog count. */
export const NAMED_WATER_COUNT = destinations.length;

export const destinationById = (id: string) =>
  destinations.find((d) => d.id === id);

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
    .filter(
      (row): row is RelatedWater & { destination: Destination } => row !== null,
    );
}

export const states = [...new Set(destinations.map((d) => d.state))].sort();

/** Canadian provinces and territories held by the catalog, in official order. */
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

export const jurisdictionOf = (d: Destination): Jurisdiction =>
  isProvince(d.state) ? "ca" : "us";

/** Provinces and territories that actually carry records, sorted. */
export const provinces = states.filter(isProvince);

/** US states that actually carry records, sorted. */
export const usStates = states.filter((s) => !isProvince(s));

export const waterTypes: WaterType[] = ["lake", "reservoir", "river", "marine"];

export const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/\s+/g, " ").trim();

export const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Catalog tags stored on the record (waterType, access anatomy, land-manager
 * class). Derived only from documented fields — never estimated live state.
 */
export function catalogTags(d: Destination): string[] {
  return [...(d.tags ?? [])].sort();
}

/** Display label for a catalog tag slug. */
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

export const displayName = (d: Destination) =>
  d.accessSite ? `${d.waterbody} — ${d.accessSite}` : d.waterbody;

/** Printed YYYY-MM-DD prefix — the same date a packet shows as last updated. */
function printedDay(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcToday(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Calendar days between the stamp's printed date and UTC today.
 *
 * Do not round elapsed milliseconds. A check at 17:20 on the 8th was
 * showing "6d ago" on the 15th because 6×24h had not quite elapsed.
 * The packet prints the date prefix; this ages by that same date.
 */
export function daysSince(iso: string, now = new Date()): number {
  const then = printedDay(iso);
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.round((utcToday(now) - then) / 86_400_000));
}

/** True when today's UTC date is after the record's next-review date. */
export function reviewOverdue(d: Destination, now = new Date()): boolean {
  const due = printedDay(d.nextReviewAt);
  if (Number.isNaN(due)) return false;
  return utcToday(now) > due;
}

/** True when regs or access review dates are older than 90 days. */
export function reviewDue(d: Destination, now = new Date()): boolean {
  const maxAge = 90 * 86_400_000;
  const check = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && now.getTime() - t > maxAge;
  };
  return check(d.regsReviewedDate) || check(d.accessReviewedDate);
}
