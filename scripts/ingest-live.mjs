#!/usr/bin/env node
/**
 * Scheduled ingest of official readings for every matched binding.
 *
 * USGS NWIS IV, NOAA CO-OPS latest, Water Survey of Canada realtime,
 * and the NWS observation station bound on the record. Agency
 * observations only. A silent feed is a miss.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BIND_PATH = resolve(ROOT, "src/data/station-bindings.json");
const OUT_PATH = resolve(ROOT, "public/live/snapshot.json");

const UA = "HookTheHorizon-FieldSense/0.5 (rachel.elise.anderson@gmail.com)";
const USGS_PARAMS = {
  "00060": { label: "Streamflow", unit: "ft³/s" },
  "00065": { label: "Gage height", unit: "ft" },
  "00010": { label: "Water temperature", unit: "°C" },
  "62614": { label: "Lake or reservoir elevation", unit: "ft" },
  "62615": { label: "Lake or reservoir elevation (NAVD88)", unit: "ft" },
  "00062": { label: "Reservoir elevation", unit: "ft" },
  "72020": { label: "Reservoir storage", unit: "ac-ft" },
};
const BATCH = 40;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function poolMap(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
}

function emptyStation(siteId, agency, extra = {}) {
  return {
    siteId,
    agency,
    siteName: extra.siteName ?? null,
    readings: extra.readings ?? [],
    fetchedAt: new Date().toISOString(),
    error: extra.error,
  };
}

async function usgsBatch(siteIds) {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json` +
    `&sites=${siteIds.join(",")}` +
    `&parameterCd=00060,00065,00010,62614,62615,00062,72020&siteStatus=active`;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`USGS IV ${res.status}`);
      const json = await res.json();
      const bySite = new Map();
      for (const ts of json.value?.timeSeries ?? []) {
        const siteId = ts.sourceInfo?.siteCode?.[0]?.value;
        const siteName = ts.sourceInfo?.siteName ?? "";
        const code = ts.variable?.variableCode?.[0]?.value ?? "";
        const meta = USGS_PARAMS[code];
        const point = ts.values?.[0]?.value?.slice(-1)[0];
        if (!siteId || !meta || !point?.value || point.value === "-999999") continue;
        if (!bySite.has(siteId)) bySite.set(siteId, { siteId, siteName, readings: [] });
        bySite.get(siteId).readings.push({
          label: meta.label,
          value: point.value,
          unit: meta.unit,
          observedAt: point.dateTime ?? "",
        });
      }
      return bySite;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr ?? new Error("USGS IV failed");
}

async function noaaProduct(siteId, product, extra = "") {
  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?date=latest&station=${siteId}&product=${product}` +
    `${extra}&time_zone=gmt&units=english&application=HookTheHorizon&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

function noaaIso(t) {
  if (!t) return "";
  return t.includes("T") ? t : `${t.replace(" ", "T")}Z`;
}

async function noaaStation(siteId, siteName) {
  const readings = [];
  try {
    const level = await noaaProduct(siteId, "water_level", "&datum=MLLW");
    const lv = level?.data?.[0];
    if (lv?.v) {
      readings.push({
        label: "Water level (MLLW)",
        value: lv.v,
        unit: "ft",
        observedAt: noaaIso(lv.t),
      });
    }
    const wind = await noaaProduct(siteId, "wind");
    const w = wind?.data?.[0];
    if (w?.s) {
      const dir = w.dr ? ` ${w.dr}` : "";
      readings.push({
        label: "Wind",
        value: `${Number(w.s).toFixed(1)}${dir}`,
        unit: "mph",
        observedAt: noaaIso(w.t),
      });
    }
    const temp = await noaaProduct(siteId, "water_temperature");
    const tp = temp?.data?.[0];
    if (tp?.v) {
      readings.push({
        label: "Water temperature",
        value: tp.v,
        unit: "°F",
        observedAt: noaaIso(tp.t),
      });
    }
    return emptyStation(siteId, "NOAA-COOPS", {
      siteName: level?.metadata?.name ?? wind?.metadata?.name ?? siteName,
      readings,
    });
  } catch (err) {
    return emptyStation(siteId, "NOAA-COOPS", {
      siteName,
      error: String(err.message ?? err),
    });
  }
}

async function wscStation(siteId, siteName) {
  try {
    const url =
      `https://api.weather.gc.ca/collections/hydrometric-realtime/items` +
      `?f=json&limit=1&STATION_NUMBER=${encodeURIComponent(siteId)}&sortby=-DATETIME`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`WSC ${res.status}`);
    const json = await res.json();
    const p = json.features?.[0]?.properties;
    const readings = [];
    if (p?.DISCHARGE != null) {
      readings.push({
        label: "Discharge",
        value: String(p.DISCHARGE),
        unit: "m³/s",
        observedAt: p.DATETIME ?? "",
      });
    }
    if (p?.LEVEL != null) {
      readings.push({
        label: "Water level",
        value: String(p.LEVEL),
        unit: "m",
        observedAt: p.DATETIME ?? "",
      });
    }
    return emptyStation(siteId, "WSC", {
      siteName: p?.STATION_NAME ?? siteName,
      readings,
    });
  } catch (err) {
    return emptyStation(siteId, "WSC", {
      siteName,
      error: String(err.message ?? err),
    });
  }
}

function nwsReading(label, unit, value, observedAt, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return {
    label,
    value: Number(value).toFixed(digits),
    unit,
    observedAt: observedAt ?? "",
  };
}

async function nwsObservation(stationId) {
  const url = `https://api.weather.gov/stations/${stationId}/observations/latest`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`NWS ${stationId} ${res.status}`);
  const json = await res.json();
  const p = json.properties ?? {};
  const at = p.timestamp ?? "";
  const readings = [];
  if (p.windSpeed?.value != null) {
    const mph = Number(p.windSpeed.value) * 0.621371;
    const dir = p.windDirection?.value;
    const compass =
      dir == null
        ? ""
        : ` ${["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(((dir % 360) + 360) % 360 / 22.5) % 16]}`;
    readings.push({
      label: "Wind",
      value: `${mph.toFixed(1)}${compass}`,
      unit: "mph",
      observedAt: at,
    });
  }
  const air = nwsReading("Air temperature", "°C", p.temperature?.value, at);
  if (air) readings.push(air);
  if (p.textDescription) {
    readings.push({
      label: "Weather",
      value: p.textDescription,
      unit: "",
      observedAt: at,
    });
  }
  return {
    stationId,
    stationName: p.stationName ?? stationId,
    readings,
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  const bindings = JSON.parse(readFileSync(BIND_PATH, "utf8"));
  const matched = bindings.records.filter((r) => r.status === "matched" && r.siteId);
  const stations = {};
  const byAgency = { USGS: { bound: 0, withReadings: 0 }, "NOAA-COOPS": { bound: 0, withReadings: 0 }, WSC: { bound: 0, withReadings: 0 } };

  const usgsIds = [
    ...new Set(matched.filter((r) => r.agency === "USGS").map((r) => r.siteId)),
  ];
  const noaaRows = [
    ...new Map(
      matched.filter((r) => r.agency === "NOAA-COOPS").map((r) => [r.siteId, r]),
    ).values(),
  ];
  const wscRows = [
    ...new Map(matched.filter((r) => r.agency === "WSC").map((r) => [r.siteId, r])).values(),
  ];

  byAgency.USGS.bound = usgsIds.length;
  byAgency["NOAA-COOPS"].bound = noaaRows.length;
  byAgency.WSC.bound = wscRows.length;

  for (const group of chunk(usgsIds, BATCH)) {
    try {
      const batch = await usgsBatch(group);
      for (const id of group) {
        const row = batch.get(id);
        stations[id] = emptyStation(id, "USGS", {
          siteName: row?.siteName ?? null,
          readings: row?.readings ?? [],
        });
      }
      console.error(`usgs  ${group.length} sites`);
    } catch (err) {
      console.error(`fail  USGS batch: ${err.message}`);
      for (const id of group) {
        stations[id] = emptyStation(id, "USGS", { error: String(err.message) });
      }
    }
  }

  const noaaResults = await poolMap(noaaRows, 4, (r) => noaaStation(r.siteId, r.siteName));
  for (const row of noaaResults) stations[row.siteId] = row;
  console.error(`noaa  ${noaaRows.length} stations`);

  const wscResults = await poolMap(wscRows, 4, (r) => wscStation(r.siteId, r.siteName));
  for (const row of wscResults) stations[row.siteId] = row;
  console.error(`wsc   ${wscRows.length} stations`);

  const nwsIds = [
    ...new Set(bindings.records.map((r) => r.nwsStationId).filter(Boolean)),
  ];
  const observations = {};
  const nwsResults = await poolMap(nwsIds, 4, async (id) => {
    try {
      return await nwsObservation(id);
    } catch (err) {
      return {
        stationId: id,
        stationName: id,
        readings: [],
        fetchedAt: new Date().toISOString(),
        error: String(err.message ?? err),
      };
    }
  });
  for (const row of nwsResults) observations[row.stationId] = row;
  console.error(`nws   ${nwsIds.length} observation stations`);

  for (const [agency, stat] of Object.entries(byAgency)) {
    stat.withReadings = Object.values(stations).filter(
      (s) => s.agency === agency && s.readings.length > 0,
    ).length;
  }

  const withReadings = Object.values(stations).filter((s) => s.readings.length > 0).length;
  const nwsWithObs = Object.values(observations).filter((s) => s.readings.length > 0).length;
  const uniqueIds = Object.keys(stations);
  const payload = {
    schema: "0.6.0",
    ingestedAt: new Date().toISOString(),
    source: "usgs-nwis-iv+noaa-coops+wsc-geomet+nws-obs",
    cadenceMinutes: 30,
    doctrine:
      "Agency observations only. Age is printed. A silent feed is a miss, not a default.",
    stats: {
      boundStations: uniqueIds.length,
      withReadings,
      emptyOrError: uniqueIds.length - withReadings,
      destinationBindings: matched.length,
      byAgency,
      nwsStations: nwsIds.length,
      nwsWithObs,
    },
    stations,
    observations,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);
  console.error(
    `wrote ${OUT_PATH} · ${withReadings}/${uniqueIds.length} gauges` +
      ` · NWS ${nwsWithObs}/${nwsIds.length}` +
      ` · USGS ${byAgency.USGS.withReadings}/${byAgency.USGS.bound}` +
      ` · NOAA ${byAgency["NOAA-COOPS"].withReadings}/${byAgency["NOAA-COOPS"].bound}` +
      ` · WSC ${byAgency.WSC.withReadings}/${byAgency.WSC.bound}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
