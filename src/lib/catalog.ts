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

/** Days since the record was last verified against its official source. */
export function daysSince(iso: string, now = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.round((now.getTime() - then) / 86_400_000));
}

export function reviewOverdue(d: Destination, now = new Date()): boolean {
  const due = new Date(d.nextReviewAt).getTime();
  return !Number.isNaN(due) && now.getTime() > due;
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
