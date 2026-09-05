/**
 * Pure helpers for scheduled ingest. Kept separate so the runner can stay
 * I/O-heavy and these rules can be unit-tested without hitting agencies.
 */

import {
  STALE_WINDOW_NOTE,
  applyObservationAge,
  applyObservationAgeMap,
} from "./observation-age.mjs";

export const CRITICAL_STATES = new Set([
  "Colorado",
  "Wyoming",
  "Montana",
  "Idaho",
  "Utah",
  "New Mexico",
  "Arizona",
]);

export const SLOW_AGENCIES = new Set(["USBR"]);
export const DAILY_AGENCIES = new Set(["CDEC", "USACE"]);

export const CRITICAL_CADENCE_MINUTES = 10;
export const FULL_CADENCE_MINUTES = 30;

export {
  LIVE_FRESH_MS,
  DAILY_FRESH_MS,
  STALE_WINDOW_NOTE,
  classifyReading,
  partitionReadings,
  applyObservationAge,
  applyObservationAgeMap,
} from "./observation-age.mjs";

export function parseArgs(argv = []) {
  const out = { mode: "all", skipSlow: false, onlySlow: false, merge: false };
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    if (raw === "--skip-slow") out.skipSlow = true;
    else if (raw === "--only-slow") out.onlySlow = true;
    else if (raw === "--merge") out.merge = true;
    else if (raw.startsWith("--mode=")) out.mode = raw.slice("--mode=".length);
  }
  if (out.mode !== "critical") out.mode = "all";
  if (out.onlySlow) {
    out.skipSlow = false;
    out.mode = "all";
  }
  return out;
}

export function isCriticalRecord(record) {
  if (!record?.siteId || record.status !== "matched") return false;
  if (SLOW_AGENCIES.has(record.agency) || DAILY_AGENCIES.has(record.agency)) return false;
  if (record.source === "override") return true;
  if (CRITICAL_STATES.has(record.state)) return true;
  if (record.agency === "NOAA-COOPS") return true;
  return false;
}

export function selectRecords(records, opts) {
  const matched = (records ?? []).filter((r) => r.status === "matched" && r.siteId);
  if (opts.onlySlow) return matched.filter((r) => SLOW_AGENCIES.has(r.agency));
  let rows = matched;
  if (opts.mode === "critical") rows = rows.filter(isCriticalRecord);
  if (opts.skipSlow) rows = rows.filter((r) => !SLOW_AGENCIES.has(r.agency));
  return rows;
}

export function cadenceFor(opts) {
  if (opts.onlySlow) return FULL_CADENCE_MINUTES;
  if (opts.mode === "critical") return CRITICAL_CADENCE_MINUTES;
  return FULL_CADENCE_MINUTES;
}

function retainNote(cause) {
  return `${cause}; last agency observation retained. Age is printed.`;
}

export function carryForward(prevStations = {}, nextStations = {}, now = Date.now()) {
  const out = {};
  for (const [id, raw] of Object.entries(nextStations)) {
    const next = applyObservationAge(raw, now);
    if (next.readings.length) {
      out[id] = next;
      continue;
    }
    const prev = applyObservationAge(prevStations[id] ?? {}, now);
    if (prev.readings.length) {
      const cause = raw?.error ? String(raw.error) : "Feed silent this cycle";
      out[id] = {
        ...next,
        siteName: next.siteName || prev.siteName || null,
        readings: prev.readings,
        retainedReadings: next.retainedReadings.length
          ? next.retainedReadings
          : prev.retainedReadings,
        carriedForward: true,
        staleOnly: false,
        error: retainNote(cause),
      };
      continue;
    }
    const retained = next.retainedReadings.length ? next.retainedReadings : prev.retainedReadings;
    out[id] = {
      ...next,
      readings: [],
      retainedReadings: retained,
      staleOnly: retained.length > 0,
      error: retained.length
        ? next.error && /freshness window/i.test(next.error)
          ? next.error
          : [raw?.error, STALE_WINDOW_NOTE].filter(Boolean).join("; ")
        : next.error,
    };
  }
  return out;
}

export function mergeStations(prevStations, nextStations, now = Date.now()) {
  const merged = { ...(prevStations ?? {}), ...(nextStations ?? {}) };
  return carryForward(prevStations ?? {}, merged, now);
}

export function mergeObservations(prevObs = {}, nextObs = {}, now = Date.now()) {
  const merged = { ...prevObs, ...nextObs };
  return carryForward(prevObs, merged, now);
}

export function rebuildStats(stations, observations, destinationBindings = 0) {
  const byAgency = {};
  let withStaleOnly = 0;
  for (const s of Object.values(stations ?? {})) {
    const agency = s.agency ?? "unknown";
    if (!byAgency[agency]) byAgency[agency] = { bound: 0, withReadings: 0, withStaleOnly: 0 };
    byAgency[agency].bound += 1;
    if (s.readings?.length) byAgency[agency].withReadings += 1;
    else if (s.retainedReadings?.length) {
      byAgency[agency].withStaleOnly += 1;
      withStaleOnly += 1;
    }
  }
  const ids = Object.keys(stations ?? {});
  const withReadings = Object.values(stations ?? {}).filter((s) => s.readings?.length).length;
  const nwsIds = Object.keys(observations ?? {});
  const nwsWithObs = Object.values(observations ?? {}).filter((s) => s.readings?.length).length;
  return {
    boundStations: ids.length,
    withReadings,
    withStaleOnly,
    emptyOrError: ids.length - withReadings,
    destinationBindings,
    byAgency,
    nwsStations: nwsIds.length,
    nwsWithObs,
  };
}

export function finalizeSnapshot(payload, now = Date.now()) {
  const stations = applyObservationAgeMap(payload.stations, now);
  const observations = applyObservationAgeMap(payload.observations ?? {}, now);
  return {
    ...payload,
    stations,
    observations,
    stats: rebuildStats(stations, observations, payload.stats?.destinationBindings ?? 0),
  };
}

function pruneMergedStations(stations, nextStations, mode) {
  if (mode === "all") {
    const currentIds = new Set(Object.keys(nextStations ?? {}));
    const slowIncluded = Object.values(nextStations ?? {}).some((s) =>
      SLOW_AGENCIES.has(s?.agency),
    );
    return Object.fromEntries(
      Object.entries(stations ?? {}).filter(
        ([id, row]) => currentIds.has(id) || (!slowIncluded && SLOW_AGENCIES.has(row?.agency)),
      ),
    );
  }
  if (mode === "slow") {
    const currentSlowIds = new Set(Object.keys(nextStations ?? {}));
    return Object.fromEntries(
      Object.entries(stations ?? {}).filter(
        ([id, row]) => !SLOW_AGENCIES.has(row?.agency) || currentSlowIds.has(id),
      ),
    );
  }
  return stations;
}

function pruneMergedObservations(observations, nextObservations, mode) {
  if (mode !== "all") return observations;
  const currentIds = new Set(Object.keys(nextObservations ?? {}));
  return Object.fromEntries(
    Object.entries(observations ?? {}).filter(([id]) => currentIds.has(id)),
  );
}

export function mergeSnapshot(prev, next, meta) {
  const now = Date.parse(meta.ingestedAt) || Date.now();
  let stations = mergeStations(prev?.stations, next.stations, now);
  let observations = mergeObservations(prev?.observations, next.observations, now);
  stations = pruneMergedStations(stations, next.stations, meta.mode);
  observations = pruneMergedObservations(observations, next.observations, meta.mode);
  const destinationBindings =
    next.stats?.destinationBindings ?? prev?.stats?.destinationBindings ?? 0;
  return {
    schema: next.schema ?? prev?.schema ?? "0.6.0",
    ingestedAt: meta.ingestedAt,
    source: next.source ?? prev?.source,
    cadenceMinutes: meta.cadenceMinutes,
    doctrine:
      next.doctrine ??
      prev?.doctrine ??
      "Agency observations only. Age is printed. A silent feed is a miss, not a default. Observation time, not ingest time, decides whether a value is current.",
    stats: rebuildStats(stations, observations, destinationBindings),
    stations,
    observations,
    mode: meta.mode,
  };
}

export function collectErrors(stations, observations) {
  const errors = [];
  for (const s of Object.values(stations ?? {})) {
    if (!s.error) continue;
    errors.push({
      kind: "station",
      agency: s.agency ?? null,
      siteId: s.siteId,
      error: s.error,
      carriedForward: Boolean(s.carriedForward),
      staleOnly: Boolean(s.staleOnly),
    });
  }
  for (const o of Object.values(observations ?? {})) {
    if (!o.error) continue;
    errors.push({
      kind: "nws",
      agency: "NWS",
      siteId: o.stationId,
      error: o.error,
      carriedForward: Boolean(o.carriedForward),
      staleOnly: Boolean(o.staleOnly),
    });
  }
  return errors;
}

export function buildStatus({ payload, opts, runUrl = null, errors = [] }) {
  const usbr = payload.stats?.byAgency?.USBR ?? { bound: 0, withReadings: 0 };
  const usbrTimeouts = errors.filter(
    (e) => e.agency === "USBR" && /timeout|aborted/i.test(e.error ?? ""),
  ).length;
  const hard = errors.filter((e) => !e.carriedForward && !e.staleOnly);
  const mode = opts.onlySlow ? "slow" : opts.mode;
  return {
    schema: "0.1.0",
    ok: true,
    degraded: errors.length > 0,
    mode,
    ingestedAt: payload.ingestedAt,
    cadenceMinutes: payload.cadenceMinutes,
    criticalCadenceMinutes: CRITICAL_CADENCE_MINUTES,
    fullCadenceMinutes: FULL_CADENCE_MINUTES,
    stats: payload.stats,
    errorCount: errors.length,
    hardErrorCount: hard.length,
    errors: errors.slice(0, 40),
    usbr: { ...usbr, timeouts: usbrTimeouts },
    runUrl,
    archiveRetentionHours: 24,
    doctrine: payload.doctrine,
  };
}

/**
 * Webhooks / the health issue fire on a crashed job or a miss with no
 * last official value to retain. A USBR timeout that carried the previous
 * observation, or a fossil IV value older than the window, is printed in
 * status.json — it is not a page.
 */
export function shouldNotify(status, { failed = false } = {}) {
  if (failed) return true;
  if (!status) return false;
  return (status.hardErrorCount ?? 0) > 0;
}
