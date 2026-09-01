import { destinations, type Destination } from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";

/* ------------------------------------------------------------------ *
 * Where to go next in the catalog
 *
 * Neighbourhood without coordinates: the other named public waters that
 * share this record's region, jurisdiction or water class. It answers
 * "if this one does not work, what else is within reach of the same drive"
 * at the only resolution this instrument publishes — the jurisdiction and
 * the region the agency itself named.
 * ------------------------------------------------------------------ */

export interface NearbyGroup {
  key: "region" | "type" | "state";
  label: string;
  note: string;
  waters: Destination[];
}

const byReadiness = (a: Destination, b: Destination) => readiness(b).score - readiness(a).score;

export function nearbyWaters(d: Destination, limit = 6): NearbyGroup[] {
  const excluded = new Set<string>([d.id, ...(d.related ?? []).map((r) => r.id)]);
  const inState = destinations.filter((x) => x.state === d.state && !excluded.has(x.id));

  const region = inState.filter((x) => x.region === d.region).sort(byReadiness);
  const regionIds = new Set(region.map((x) => x.id));

  const sameType = inState
    .filter((x) => !regionIds.has(x.id) && x.waterType === d.waterType)
    .sort(byReadiness);
  const typeIds = new Set(sameType.map((x) => x.id));

  const rest = inState.filter((x) => !regionIds.has(x.id) && !typeIds.has(x.id)).sort(byReadiness);

  const groups: NearbyGroup[] = [];

  if (region.length) {
    groups.push({
      key: "region",
      label: `More water in ${d.region}`,
      note: "Same region as named by the agency — the shortest move if this record does not work out.",
      waters: region.slice(0, limit),
    });
  }
  if (sameType.length) {
    groups.push({
      key: "type",
      label: `Other ${d.waterType} water in ${d.state}`,
      note: "Same water class, so the read you have just done still applies.",
      waters: sameType.slice(0, limit),
    });
  }
  if (groups.length === 0 && rest.length) {
    groups.push({
      key: "state",
      label: `Elsewhere in ${d.state}`,
      note: "Same jurisdiction, so the licence and the regulation booklet are the same.",
      waters: rest.slice(0, limit),
    });
  }

  return groups;
}
