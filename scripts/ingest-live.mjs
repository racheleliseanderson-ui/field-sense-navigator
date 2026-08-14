#!/usr/bin/env node
/**
 * Scheduled USGS instantaneous-values ingest.
 *
 * Reads the committed station-bindings file, pulls current readings for
 * every matched USGS site in batches, and writes a snapshot. The snapshot
 * is the last known official observation — never a forecast of fish.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BIND_PATH = resolve(ROOT, "src/data/station-bindings.json");
const OUT_PATH = resolve(ROOT, "public/live/snapshot.json");

const UA = "HookTheHorizon-FieldSense/0.5 (rachel.elise.anderson@gmail.com)";
const PARAMS = {
  "00060": { label: "Streamflow", unit: "ft³/s" },
  "00065": { label: "Gage height", unit: "ft" },
  "00010": { label: "Water temperature", unit: "°C" },
  "62614": { label: "Lake or reservoir elevation", unit: "ft" },
};
const BATCH = 80;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function usgsBatch(siteIds) {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json` +
    `&sites=${siteIds.join(",")}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`USGS IV ${res.status}`);
  }
  const json = await res.json();
  const bySite = new Map();
  for (const ts of json.value?.timeSeries ?? []) {
    const siteId = ts.sourceInfo?.siteCode?.[0]?.value;
    const siteName = ts.sourceInfo?.siteName ?? "";
    const code = ts.variable?.variableCode?.[0]?.value ?? "";
    const meta = PARAMS[code];
    const point = ts.values?.[0]?.value?.slice(-1)[0];
    if (!siteId || !meta || !point?.value || point.value === "-999999") continue;
    if (!bySite.has(siteId)) {
      bySite.set(siteId, { siteId, siteName, readings: [] });
    }
    bySite.get(siteId).readings.push({
      label: meta.label,
      value: point.value,
      unit: meta.unit,
      observedAt: point.dateTime ?? "",
    });
  }
  return bySite;
}

async function main() {
  const bindings = JSON.parse(readFileSync(BIND_PATH, "utf8"));
  const matched = bindings.records.filter((r) => r.status === "matched" && r.siteId);
  const uniqueIds = [...new Set(matched.map((r) => r.siteId))];
  const stations = {};
  let errors = 0;

  for (const group of chunk(uniqueIds, BATCH)) {
    try {
      const batch = await usgsBatch(group);
      for (const id of group) {
        const row = batch.get(id);
        stations[id] = {
          siteId: id,
          siteName: row?.siteName ?? null,
          readings: row?.readings ?? [],
          fetchedAt: new Date().toISOString(),
        };
        if (!row || row.readings.length === 0) errors += 1;
      }
      console.error(`iv    ${group.length} sites`);
    } catch (err) {
      console.error(`fail  batch: ${err.message}`);
      for (const id of group) {
        stations[id] = {
          siteId: id,
          siteName: null,
          readings: [],
          fetchedAt: new Date().toISOString(),
          error: String(err.message),
        };
        errors += 1;
      }
    }
  }

  const withReadings = Object.values(stations).filter((s) => s.readings.length > 0).length;
  const ingestedAt = new Date().toISOString();
  const payload = {
    schema: "0.5.0",
    ingestedAt,
    source: "usgs-nwis-iv",
    cadenceMinutes: 30,
    doctrine:
      "Agency observations only. Age is printed. A silent feed is a miss, not a default.",
    stats: {
      boundStations: uniqueIds.length,
      withReadings,
      emptyOrError: errors,
      destinationBindings: matched.length,
    },
    stations,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);
  console.error(
    `wrote ${OUT_PATH} · ${withReadings}/${uniqueIds.length} stations with readings`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
