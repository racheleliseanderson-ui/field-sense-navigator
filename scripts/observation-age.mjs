/**
 * Observation-age fail-closed.
 *
 * Ingest time is not freshness. A 1990 USGS IV value is a miss for the
 * current slot. The last official number may be retained with its original
 * observedAt. Age is printed. Nothing is invented.
 *
 * Windows:
 *   48 h  — stage, flow, discharge, water level, wind, weather, temperature
 *   7 d   — reservoir / lake elevation, storage, reservoir stage (daily agencies)
 */

export const LIVE_FRESH_MS = 48 * 60 * 60 * 1000;
export const DAILY_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_WINDOW_NOTE =
  "Last official observation is older than the freshness window (48 h for stage, flow, and weather; 7 d for reservoir elevation). Age is printed.";

export function freshnessKind(label = "") {
  const l = String(label).toLowerCase();
  if (/reservoir|lake or reservoir|storage|reservoir stage|reservoir elevation/.test(l)) {
    return "daily";
  }
  return "live";
}

export function freshnessWindowMs(label) {
  return freshnessKind(label) === "daily" ? DAILY_FRESH_MS : LIVE_FRESH_MS;
}

export function parseObservedAt(iso) {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

export function classifyReading(reading, now = Date.now()) {
  const t = parseObservedAt(reading?.observedAt);
  if (!Number.isFinite(t)) {
    return { freshness: "unknown-age", ageMs: null };
  }
  const ageMs = now - t;
  if (ageMs > freshnessWindowMs(reading?.label)) {
    return { freshness: "stale", ageMs };
  }
  return { freshness: "fresh", ageMs };
}

function bareReading(reading) {
  return {
    label: reading.label,
    value: reading.value,
    unit: reading.unit ?? "",
    observedAt: reading.observedAt ?? "",
  };
}

export function partitionReadings(readings = [], now = Date.now()) {
  const fresh = [];
  const retained = [];
  for (const raw of readings) {
    if (!raw) continue;
    const { freshness } = classifyReading(raw, now);
    if (freshness === "fresh") fresh.push(bareReading(raw));
    else retained.push(bareReading(raw));
  }
  return { readings: fresh, retainedReadings: retained };
}

function unionReadings(row) {
  return [...(row?.readings ?? []), ...(row?.retainedReadings ?? [])];
}

export function applyObservationAge(row = {}, now = Date.now()) {
  const { readings, retainedReadings } = partitionReadings(unionReadings(row), now);
  const out = { ...row, readings, retainedReadings, staleOnly: false };
  if (readings.length === 0 && retainedReadings.length > 0) {
    out.staleOnly = true;
    const err = row.error ? String(row.error) : "";
    if (!err) out.error = STALE_WINDOW_NOTE;
    else if (!/freshness window/i.test(err)) out.error = `${err}; ${STALE_WINDOW_NOTE}`;
  }
  return out;
}

export function applyObservationAgeMap(rows = {}, now = Date.now()) {
  const out = {};
  for (const [id, row] of Object.entries(rows)) {
    out[id] = applyObservationAge(row, now);
  }
  return out;
}
