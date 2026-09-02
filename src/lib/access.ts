import { humanize, type AccessPoint, type Destination } from "@/lib/catalog";

/* ------------------------------------------------------------------ *
 * Access, launches and logistics
 *
 * Everything here is a reading of what the official source published on the
 * record: the named facilities, their published type and status, and the
 * amenity wording the agency used. Nothing is inferred about a facility that
 * the record does not name, and an unstated amenity is reported as unstated
 * rather than as absent.
 * ------------------------------------------------------------------ */

export type AccessKind = "trailer_launch" | "hand_launch" | "pier" | "shore" | "directory";

export const ACCESS_KIND_LABEL: Record<AccessKind, string> = {
  trailer_launch: "Trailer launch",
  hand_launch: "Hand launch",
  pier: "Pier or dock",
  shore: "Shore or walk-in",
  directory: "Official directory",
};

export const ACCESS_KIND_NOTE: Record<AccessKind, string> = {
  trailer_launch: "A published ramp a trailered boat can use.",
  hand_launch: "Carry-in access for a kayak, canoe or cartop craft.",
  pier: "A built platform you can fish from on foot.",
  shore: "Public bank, beach or walk-in frontage.",
  directory: "A network of official sites, not one named place.",
};

const KIND_RX: Array<{ kind: AccessKind; rx: RegExp }> = [
  { kind: "directory", rx: /directory|finder|multiple_official_access|network/i },
  {
    kind: "hand_launch",
    rx: /hand[_ -]?launch|cartop|carry|canoe|kayak|paddle|small[_ -]?craft|float[_ -]?access|non-?motor/i,
  },
  {
    kind: "trailer_launch",
    rx: /boat[_ -]?launch|boat[_ -]?ramp|\bramp\b|marina|boating|boat[_ -]?access/i,
  },
  { kind: "pier", rx: /pier|wharf|\bdock/i },
  {
    kind: "shore",
    rx: /shore|walk[_ -]?in|\bbank\b|beach|trail[_ -]?access|park[_ -]?access|jetty|platform/i,
  },
];

const CLOSED_RX = /closed|unavailable|out of service|removed|suspend/i;
const SEASONAL_RX = /seasonal|winter|summer only|closes|open .* through/i;

/** Logistics a reader plans around, read out of the agency's own amenity wording. */
export interface LogisticSignal {
  id: string;
  label: string;
  note: string;
}

const LOGISTICS: Array<LogisticSignal & { rx: RegExp }> = [
  {
    id: "parking",
    label: "Parking",
    note: "Parking is named on the official source. Capacity on the day is not.",
    rx: /parking|trailer parking|lot\b/i,
  },
  {
    id: "restrooms",
    label: "Restrooms",
    note: "Toilets are named on the official source. Seasonal closure is common and not tracked here.",
    rx: /restroom|toilet|vault|washroom|comfort station/i,
  },
  {
    id: "camping",
    label: "Camping",
    note: "Camping is named at or beside this access. Reservations and season are the agency's to state.",
    rx: /camp(ground|ing|site)?\b/i,
  },
  {
    id: "accessible",
    label: "Accessible facility",
    note: "The source uses accessibility wording for at least one facility. Confirm the specific provision before you rely on it.",
    rx: /\bADA\b|accessible|wheelchair|barrier[- ]free/i,
  },
  {
    id: "fee",
    label: "Fee, pass or permit",
    note: "A fee, day-use pass or permit is named. Carry the payment method the agency accepts.",
    rx: /\bfee\b|day[- ]use pass|discover pass|permit|entry pass|vehicle pass/i,
  },
  {
    id: "dock",
    label: "Dock or slip",
    note: "A dock, slip or marina facility is named on the record.",
    rx: /\bdock|slip\b|marina|moorage/i,
  },
  {
    id: "cleaning",
    label: "Fish cleaning station",
    note: "A fish cleaning station is named. Disposal rules are the agency's.",
    rx: /fish clean|cleaning station/i,
  },
  {
    id: "surface",
    label: "Ramp surface named",
    note: "The source states a ramp surface — concrete, paved or gravel. Usable depth still depends on water level.",
    rx: /concrete|paved|gravel (boat )?(launch|ramp)|multi-?lane|deep-?water/i,
  },
  {
    id: "boat_in",
    label: "Boat-in only",
    note: "At least one site is reachable only by water, or has no vehicle access.",
    rx: /boat-?in|no vehicle access|water access only/i,
  },
  {
    id: "day_use",
    label: "Day use",
    note: "Day-use facilities are named. Gate hours are set locally and are not mirrored here.",
    rx: /day[- ]use/i,
  },
];

export interface AccessSite {
  name: string;
  typeLabel: string;
  kinds: AccessKind[];
  /** true open, false documented closed, null not stated by the source. */
  open: boolean | null;
  statusLabel: string | null;
  seasonal: boolean;
  amenities: string[];
  signals: LogisticSignal[];
  published: boolean;
}

export interface AccessRead {
  sites: AccessSite[];
  /** How many named sites of each kind the record documents. */
  counts: Record<AccessKind, number>;
  /** Every logistics signal the record's amenity wording supports. */
  logistics: LogisticSignal[];
  namedSites: number;
  directoryOnly: boolean;
  anyClosed: boolean;
  /** One honest sentence describing the access position. */
  readout: string;
  unknowns: string[];
}

function kindsFor(a: AccessPoint): AccessKind[] {
  const blob = `${a.type} ${a.name}`;
  const kinds: AccessKind[] = [];
  for (const k of KIND_RX) {
    if (k.rx.test(blob) && !kinds.includes(k.kind)) kinds.push(k.kind);
  }
  // A directory entry is a network, not a facility of a particular kind.
  if (kinds.includes("directory")) return ["directory"];
  return kinds;
}

function signalsFor(a: AccessPoint): LogisticSignal[] {
  const blob = [...(a.amenities ?? []), a.name, a.type].join(" ");
  const out: LogisticSignal[] = [];
  for (const s of LOGISTICS) {
    if (s.rx.test(blob)) out.push({ id: s.id, label: s.label, note: s.note });
  }
  return out;
}

export function readAccess(d: Destination): AccessRead {
  const sites: AccessSite[] = d.publicAccess.map((a) => {
    const status = a.status ?? null;
    return {
      name: a.name,
      typeLabel: humanize(a.type),
      kinds: kindsFor(a),
      open: status ? !CLOSED_RX.test(status) : null,
      statusLabel: status ? humanize(status) : null,
      seasonal: SEASONAL_RX.test(`${status ?? ""} ${(a.amenities ?? []).join(" ")}`),
      amenities: a.amenities ?? [],
      signals: signalsFor(a),
      published: a.officiallyPublished !== false,
    };
  });

  const counts: Record<AccessKind, number> = {
    trailer_launch: 0,
    hand_launch: 0,
    pier: 0,
    shore: 0,
    directory: 0,
  };
  for (const s of sites) for (const k of s.kinds) counts[k] += 1;

  const seen = new Set<string>();
  const logistics: LogisticSignal[] = [];
  for (const s of sites) {
    for (const sig of s.signals) {
      if (seen.has(sig.id)) continue;
      seen.add(sig.id);
      logistics.push(sig);
    }
  }

  const directoryOnly = sites.length > 0 && sites.every((s) => s.kinds.includes("directory"));
  const namedSites = sites.filter((s) => !s.kinds.includes("directory")).length;
  const anyClosed = sites.some((s) => s.open === false);

  const readout =
    sites.length === 0
      ? "No public access facility is named on the record for this water. Nothing is assumed in its place."
      : directoryOnly
        ? "Access is published as an official directory of sites rather than one named place. Choose a site from that directory before you travel."
        : anyClosed
          ? `${namedSites} named public facilit${namedSites === 1 ? "y" : "ies"} on record, at least one documented closed. Confirm which are open on the day.`
          : `${namedSites} named public facilit${namedSites === 1 ? "y" : "ies"} on record${
              counts.trailer_launch > 0
                ? `, ${counts.trailer_launch} usable by a trailered boat`
                : ""
            }${counts.shore > 0 ? `, ${counts.shore} with shore or walk-in frontage` : ""}.`;

  return {
    sites,
    counts,
    logistics,
    namedSites,
    directoryOnly,
    anyClosed,
    readout,
    unknowns: [
      "Gate hours, fees and same-day closures are set locally and are not mirrored here.",
      "Facility condition — ramp surface, dock presence, depth at the ramp — is only known where the source stated it.",
      "An amenity that is not listed is an amenity the source did not publish, not one that is absent.",
      "Where a public corridor runs beside private land, the boundary is outside this dataset.",
    ],
  };
}

/** Compact one-line logistics summary for cards and the printed brief. */
export function logisticsLine(read: AccessRead): string {
  if (read.logistics.length === 0) return "No amenity wording published on the record.";
  return read.logistics.map((l) => l.label).join(" · ");
}

/* ---------------- logistics as a catalog facet ---------------- */

/** The logistics worth filtering a catalog on. Order is the order shown. */
/**
 * Short labels for the filter row, keyed by signal id.
 *
 * This used to be a hand-kept second list, and it had drifted: `boat_in`,
 * `day_use` and `surface` were being read off 178 records and printed on
 * the record page, but were missing here, so no reader could ever filter
 * for them and the replica's logistics column carried ids the interface
 * could not ask for. The facet list is now derived from the signals, so
 * the two cannot fall out of step again.
 */
const FACET_LABELS: Record<string, string> = {
  parking: "Parking",
  restrooms: "Restrooms",
  camping: "Camping",
  accessible: "Accessible",
  dock: "Dock or slip",
  cleaning: "Fish cleaning",
  fee: "Fee or permit",
  surface: "Ramp surface",
  boat_in: "Boat-in only",
  day_use: "Day use",
};

export const LOGISTICS_FACETS: ReadonlyArray<{ id: string; label: string }> =
  LOGISTICS.map((s) => ({ id: s.id, label: FACET_LABELS[s.id] ?? s.label }));

/**
 * Amenity wording is agency free text, so this index is built once and reused.
 * A water matches a facet only when its own source used wording that supports
 * it — a miss means the source was silent, not that the facility is absent.
 */
const logisticsIndex = new Map<string, ReadonlySet<string>>();

export function logisticsIdsFor(d: Destination): ReadonlySet<string> {
  const cached = logisticsIndex.get(d.id);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const a of d.publicAccess) for (const s of signalsFor(a)) ids.add(s.id);
  logisticsIndex.set(d.id, ids);
  return ids;
}

export function matchesLogistics(d: Destination, facet: string): boolean {
  return logisticsIdsFor(d).has(facet);
}
