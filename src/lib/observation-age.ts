/**
 * Freshness is decided by when a value was observed, never by when we collected
 * it. Keep in lockstep with scripts/observation-age.mjs.
 */

export const LIVE_FRESH_MS = 48 * 60 * 60 * 1000;
export const DAILY_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_WINDOW_NOTE =
  "The last official observation is older than we treat as current — 48 hours for level, flow and weather, 7 days for reservoir elevation. The time it was taken is printed.";

export type Freshness = "fresh" | "stale" | "unknown-age";

export interface AgeReading {
  label: string;
  value: string;
  unit: string;
  observedAt: string;
}

export function freshnessKind(label = ""): "daily" | "live" {
  const l = String(label).toLowerCase();
  if (/reservoir|lake or reservoir|storage|reservoir stage|reservoir elevation/.test(l)) {
    return "daily";
  }
  return "live";
}

export function freshnessWindowMs(label: string): number {
  return freshnessKind(label) === "daily" ? DAILY_FRESH_MS : LIVE_FRESH_MS;
}

export function parseObservedAt(iso?: string): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

export function classifyReading(
  reading: { label?: string; observedAt?: string },
  now = Date.now(),
): { freshness: Freshness; ageMs: number | null } {
  const t = parseObservedAt(reading?.observedAt);
  if (!Number.isFinite(t)) {
    return { freshness: "unknown-age", ageMs: null };
  }
  const ageMs = now - t;
  if (ageMs > freshnessWindowMs(reading?.label ?? "")) {
    return { freshness: "stale", ageMs };
  }
  return { freshness: "fresh", ageMs };
}

function bareReading(reading: AgeReading): AgeReading {
  return {
    label: reading.label,
    value: reading.value,
    unit: reading.unit ?? "",
    observedAt: reading.observedAt ?? "",
  };
}

export function partitionReadings(
  readings: AgeReading[] = [],
  now = Date.now(),
): { readings: AgeReading[]; retainedReadings: AgeReading[] } {
  const fresh: AgeReading[] = [];
  const retained: AgeReading[] = [];
  for (const raw of readings) {
    if (!raw) continue;
    const { freshness } = classifyReading(raw, now);
    if (freshness === "fresh") fresh.push(bareReading(raw));
    else retained.push(bareReading(raw));
  }
  return { readings: fresh, retainedReadings: retained };
}

export function presentReadings(
  row:
    | {
        readings?: AgeReading[];
        retainedReadings?: AgeReading[];
      }
    | null
    | undefined,
  now = Date.now(),
): { readings: AgeReading[]; retainedReadings: AgeReading[] } {
  return partitionReadings(
    [...(row?.readings ?? []), ...(row?.retainedReadings ?? [])],
    now,
  );
}
