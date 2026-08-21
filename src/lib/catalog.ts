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

const assembled: Destination[] = [
  ...(base as Destination[]),
  ...(bcInterior as Destination[]),
];

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

export const destinations = applyEnrichments(
  assembled,
  allSeasonWindowEnrichments,
);

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

export const provinces = states.filter(isProvince);

export const usStates = states.filter((s) => !isProvince(s));

export const waterTypes: WaterType[] = ["lake", "reservoir", "river", "marine"];

export const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/\s+/g, " ").trim();

export const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

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

export function reviewOverdue(d: Destination, now = new Date()): boolean {
  const due = printedDay(d.nextReviewAt);
  if (Number.isNaN(due)) return false;
  return utcToday(now) > due;
}

export function reviewDue(d: Destination, now = new Date()): boolean {
  const maxAge = 90 * 86_400_000;
  const check = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && now.getTime() - t > maxAge;
  };
  return check(d.regsReviewedDate) || check(d.accessReviewedDate);
}
