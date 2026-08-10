import raw from "@/data/destinations.json";

export type WaterType = "lake" | "reservoir" | "river" | "marine";

export interface AccessPoint {
  name: string;
  type: string;
  status?: string;
  officiallyPublished?: boolean;
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
}

export const SCHEMA_VERSION = "0.4.0";

export const destinations = raw as Destination[];

export const destinationById = (id: string) =>
  destinations.find((d) => d.id === id);

export const states = [...new Set(destinations.map((d) => d.state))].sort();

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