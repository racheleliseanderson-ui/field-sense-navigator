#!/usr/bin/env node
/**
 * Bind an official weather observation station to every located water.
 *
 * US: NWS points API → first observation station on that grid.
 * CA: skipped here (NWS has no grid). Gauge + forecast layers still apply
 *     where a WSC station or location exists.
 *
 * Runs against the committed locations + bindings files. Does not invent gauges.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Published location precision.
 *
 * A waterbody location is published at three decimal places — roughly 100 m.
 * That is the resolution a reach, basin or reservoir arm is identified at, and
 * it is all any consumer here needs: the only runtime use is an NWS gridpoint
 * lookup, which resolves to a ~2.5 km cell.
 *
 * The raw geocoder returns up to fifteen decimals. Publishing that is false
 * precision — it states a confidence about a lake's position that nothing
 * behind it supports, and it reads like a targeting coordinate rather than a
 * jurisdiction. Coarsen once, here, so nothing downstream has to decide.
 *
 * This is a precision rule, not a privacy rule. The privacy rule is upstream:
 * only named public water enters the catalog at all.
 */
const LOCATION_DECIMALS = 3;
const coarsen = (v) =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(LOCATION_DECIMALS)) : null;
const coarsenLocations = (rows) => {
  for (const row of rows) {
    row.lat = coarsen(row.lat);
    row.lon = coarsen(row.lon);
  }
  return rows;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOC_PATH = resolve(ROOT, "src/data/locations.json");
const BIND_PATH = resolve(ROOT, "src/data/station-bindings.json");

// Agencies use this to reach whoever is generating the traffic. A private
// address does not belong in a public repository or in a header sent to five
// federal and provincial agencies on every run.
const CONTACT =
  process.env.AGENCY_CONTACT_URL || "https://northernlanternhouse.com/customer-support";
const UA = `HookTheHorizon-FieldSense/0.6 (+https://waterways.hookthehorizon.blog; contact ${CONTACT})`;
const PROVINCES = new Set([
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
]);

const nwsCache = new Map();

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json, application/json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function nwsObservationStation(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (nwsCache.has(key)) return nwsCache.get(key);
  try {
    const point = await fetchJson(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    );
    const stationsUrl = point.properties?.observationStations;
    if (!stationsUrl) {
      nwsCache.set(key, { id: null, name: null });
      return nwsCache.get(key);
    }
    const col = await fetchJson(stationsUrl);
    const first = col.features?.[0]?.properties;
    const hit = first?.stationIdentifier
      ? { id: first.stationIdentifier, name: first.name ?? first.stationIdentifier }
      : { id: null, name: null };
    nwsCache.set(key, hit);
    return hit;
  } catch {
    nwsCache.set(key, { id: null, name: null });
    return nwsCache.get(key);
  }
}

async function main() {
  const locations = JSON.parse(readFileSync(LOC_PATH, "utf8"));
  const bindings = JSON.parse(readFileSync(BIND_PATH, "utf8"));
  const locById = new Map((locations.records ?? []).map((r) => [r.destinationId, r]));

  for (const row of bindings.records) {
    const loc = locById.get(row.destinationId);
    if (loc?.status === "located" && loc.lat != null && loc.lon != null) {
      if (row.lat == null || row.lon == null) {
        row.lat = loc.lat;
        row.lon = loc.lon;
      }
      row.locationKind = loc.kind;
      row.locationName = loc.gazetteerName;
    }
  }

  const need = bindings.records.filter(
    (r) => r.lat != null && r.lon != null && !PROVINCES.has(r.state) && !r.nwsStationId,
  );
  console.error(`nws   binding ${need.length} US waters`);
  const queue = [...need];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const row = queue.shift();
      if (!row) return;
      const nws = await nwsObservationStation(row.lat, row.lon);
      row.nwsStationId = nws.id;
      row.nwsStationName = nws.name;
      done += 1;
      if (done % 25 === 0) console.error(`nws   ${done}/${need.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  bindings.stats = {
    ...bindings.stats,
    located: bindings.records.filter((r) => r.lat != null && r.lon != null).length,
    nwsBound: bindings.records.filter((r) => r.nwsStationId).length,
  };
  bindings.generatedAt = new Date().toISOString();
  coarsenLocations(bindings.records);

  writeFileSync(BIND_PATH, `${JSON.stringify(bindings, null, 2)}\n`);
  console.error(
    `wrote ${BIND_PATH} · located ${bindings.stats.located}/${bindings.records.length}` +
      ` · NWS ${bindings.stats.nwsBound}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
