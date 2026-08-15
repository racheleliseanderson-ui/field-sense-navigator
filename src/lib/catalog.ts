import raw from "@/data/destinations.json";

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
}

export const SCHEMA_VERSION = "0.5.0";

export const destinations = raw as Destination[];

/** Single source of truth for every displayed catalog count. */
export const NAMED_WATER_COUNT = destinations.length;

export const destinationById = (id: string) =>
  destinations.find((d) => d.id === id);

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

export const displayName = (d: Destination) =>
  d.accessSite ? `${d.waterbody} — ${d.accessSite}` : d.waterbody;

/** UTC calendar day as epoch-ms at midnight. NaN if the input is unparseable. */
function utcDay(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return Number.NaN;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Calendar days between the record's dated source check and `now`.
 *
 * Uses the UTC date part of both timestamps so a packet that prints
 * "Last updated: 2026-08-08" ages by the same whole day the reader sees,
 * instead of rounding elapsed 24-hour blocks (which was off by one
 * whenever the check happened later in the day).
 */
export function daysSince(iso: string, now = new Date()): number {
  const then = utcDay(iso);
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.round((utcDay(now) - then) / 86_400_000));
}

/** True when today's UTC date is after the record's next-review date. */
export function reviewOverdue(d: Destination, now = new Date()): boolean {
  const due = utcDay(d.nextReviewAt);
  if (Number.isNaN(due)) return false;
  return utcDay(now) > due;
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
