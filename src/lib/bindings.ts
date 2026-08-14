import raw from "@/data/station-bindings.json";

export type BindingStatus = "matched" | "unmatched" | "unsupported" | "error";
export type BindingAgency = "USGS" | "NOAA-COOPS" | "WSC";
export type BindingSource = "override" | "name-match";

export interface StationBinding {
  destinationId: string;
  state: string;
  waterbody: string;
  waterType?: string;
  status: BindingStatus;
  siteId: string | null;
  siteName: string | null;
  agency: BindingAgency | string | null;
  lat: number | null;
  lon: number | null;
  score: number;
  note: string;
  source?: BindingSource;
  nwsStationId?: string | null;
  nwsStationName?: string | null;
}

export interface BindingsFile {
  schema: string;
  generatedAt: string;
  matchFloor: number;
  doctrine: string;
  stats: {
    records: number;
    matched: number;
    unmatched: number;
    unsupported: number;
    error: number;
    overrides?: number;
    nwsBound?: number;
    byAgency?: Partial<Record<BindingAgency, number>>;
  };
  records: StationBinding[];
}

export const bindingsFile = raw as BindingsFile;

const byId = new Map(bindingsFile.records.map((r) => [r.destinationId, r]));

export const bindingFor = (id: string) => byId.get(id);

export const bindingCoverage = () => bindingsFile.stats;
