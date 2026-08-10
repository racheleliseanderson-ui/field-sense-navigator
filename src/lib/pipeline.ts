import {
  daysSince,
  destinations,
  displayName,
  reviewOverdue,
  states,
  type Destination,
} from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";

export type Severity = "clear" | "watch" | "flagged";

export interface IntegrityCheck {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  count: number;
  total: number;
  examples: string[];
}

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

function check(
  id: string,
  label: string,
  detail: string,
  failing: Destination[],
  total: number,
  watchAt: number,
  flagAt: number,
): IntegrityCheck {
  const share = pct(failing.length, total);
  return {
    id,
    label,
    detail,
    count: failing.length,
    total,
    severity: share >= flagAt ? "flagged" : share >= watchAt ? "watch" : "clear",
    examples: failing.slice(0, 4).map(displayName),
  };
}

/** Catalog integrity, computed from the records themselves. Nothing is inferred. */
export function integrity(pool: Destination[] = destinations): IntegrityCheck[] {
  const total = pool.length;
  return [
    check(
      "source",
      "Official source URL present",
      "Every record must name the agency page it was read from.",
      pool.filter((d) => !/^https?:\/\//.test(d.officialSourceUrl)),
      total,
      1,
      5,
    ),
    check(
      "review",
      "Review window current",
      "Records past their next-review date are treated as stale, not wrong.",
      pool.filter((d) => reviewOverdue(d)),
      total,
      10,
      30,
    ),
    check(
      "freshness",
      "Verified within 60 days",
      "Verification age drives the freshness component of every readiness score.",
      pool.filter((d) => daysSince(d.checkedAt) > 60),
      total,
      15,
      40,
    ),
    check(
      "access",
      "At least one published access",
      "A record with no named public facility cannot be planned from.",
      pool.filter((d) => d.publicAccess.length === 0),
      total,
      5,
      15,
    ),
    check(
      "verification",
      "Same-day verification steps present",
      "Each record must state what has to be re-checked on the day.",
      pool.filter((d) => d.directVerification.length === 0),
      total,
      5,
      20,
    ),
    check(
      "species",
      "Species context published",
      "Species wording comes from the agency page, never from inference.",
      pool.filter((d) => d.speciesContext.length === 0),
      total,
      10,
      30,
    ),
    check(
      "privacy",
      "Public classification only",
      "Any record carrying a sensitive location is withheld by the doctrine.",
      pool.filter(
        (d) =>
          d.privacy.sensitiveLocationIncluded ||
          d.privacy.classification !== "public_destination",
      ),
      total,
      1,
      1,
    ),
  ];
}

export interface CoverageRow {
  state: string;
  records: number;
  medianReadiness: number;
  overdue: number;
}

export function coverage(pool: Destination[] = destinations): CoverageRow[] {
  return states
    .map((s) => {
      const rows = pool.filter((d) => d.state === s);
      const scores = rows.map((d) => readiness(d).score).sort((a, b) => a - b);
      const mid = scores.length === 0 ? 0 : (scores[Math.floor(scores.length / 2)] ?? 0);
      return {
        state: s,
        records: rows.length,
        medianReadiness: mid,
        overdue: rows.filter((d) => reviewOverdue(d)).length,
      };
    })
    .filter((r) => r.records > 0)
    .sort((a, b) => b.records - a.records || a.state.localeCompare(b.state));
}

export interface ProbeResult {
  id: string;
  name: string;
  state: string;
  status: "matched" | "unmatched" | "error";
  station: string | null;
  readings: number;
  note: string;
}