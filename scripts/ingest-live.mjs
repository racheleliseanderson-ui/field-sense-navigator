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

async function cdecStation(siteId, siteName) {
  try {
    const url =
      `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=${encodeURIComponent(siteId)}` +
      `&SensorNums=6,15&dur_code=D&count=5`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`CDEC ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json) ? json : [];
    const pick = (pred) => {
      const list = rows.filter(pred);
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const v = Number(list[i]?.value);
        if (Number.isFinite(v) && v !== -9999) {
          const raw = list[i].obsDate || list[i].date || "";
          const m = String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
          const pad = (n) => String(n).padStart(2, "0");
          const at = m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${m[5]}:00` : raw;
          return { value: String(list[i].value), at };
        }
      }
      return null;
    };
    const readings = [];
    const elev = pick((r) => r.SENSOR_NUM === 6 || /ELE/i.test(r.sensorType ?? ""));
    const store = pick((r) => r.SENSOR_NUM === 15 || /STOR/i.test(r.sensorType ?? ""));
    if (elev) readings.push({ label: "Reservoir elevation", value: elev.value, unit: "ft", observedAt: elev.at });
    if (store) readings.push({ label: "Reservoir storage", value: store.value, unit: "ac-ft", observedAt: store.at });
    return emptyStation(siteId, "CDEC", { siteName, readings });
  } catch (err) {
    return emptyStation(siteId, "CDEC", { siteName, error: String(err.message ?? err) });
  }
}

async function usbrStation(siteId, siteName) {
  try {
    const readings = [];
    if (String(siteId).startsWith("rise:")) {
      const itemId = String(siteId).slice(5);
      const since = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
      const url =
        `https://data.usbr.gov/rise/api/result?filter[itemId]=${encodeURIComponent(itemId)}` +
        `&filter[dateTime][GT]=${since}&page[size]=5`;
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": UA, Accept: "application/vnd.api+json" },
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) throw new Error(`USBR RISE ${res.status}`);
          const json = await res.json();
          const a = json.data?.[0]?.attributes;
          if (a?.result != null) {
            readings.push({
              label: "Reservoir elevation",
              value: String(a.result),
              unit: "ft",
              observedAt: a.dateTime ?? "",
            });
          }
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (lastErr && !readings.length) throw lastErr;
    } else {
      const now = new Date();
      const start = new Date(now.getTime() - 16 * 86400000);
      const q =
        `parameter=${encodeURIComponent(String(siteId).toUpperCase() + " FB")}` +
        `&syer=${start.getUTCFullYear()}&smnth=${start.getUTCMonth() + 1}&sdy=${start.getUTCDate()}` +
        `&eyer=${now.getUTCFullYear()}&emnth=${now.getUTCMonth() + 1}&edy=${now.getUTCDate()}&format=2`;
      const res = await fetch(`https://www.usbr.gov/pn-bin/webarccsv.pl?${q}`, {
        headers: { "User-Agent": UA },
      });
      if (!res.ok) throw new Error(`USBR Hydromet ${res.status}`);
      const text = await res.text();
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => /^\d{2}\/\d{2}\/\d{4},/.test(l));
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const [d, v] = lines[i].split(",");
        const n = Number(String(v).trim());
        if (!Number.isFinite(n)) continue;
        const [mm, dd, yy] = d.split("/");
        readings.push({
          label: "Reservoir elevation",
          value: String(n),
          unit: "ft",
          observedAt: `${yy}-${mm}-${dd}T00:00:00Z`,
        });
        break;
      }
    }
    return emptyStation(siteId, "USBR", { siteName, readings });
  } catch (err) {
    return emptyStation(siteId, "USBR", { siteName, error: String(err.message ?? err) });
  }
}

async function usaceStation(siteId, siteName) {
  try {
    const [office, name] = String(siteId).includes(":") ? siteId.split(":") : ["SAS", siteId];
    const end = new Date();
    const begin = new Date(end.getTime() - 10 * 86400000);
    const url =
      `https://cwms-data.usace.army.mil/cwms-data/timeseries?office=${encodeURIComponent(office)}` +
      `&name=${encodeURIComponent(name)}` +
      `&begin=${begin.toISOString()}&end=${end.toISOString()}&page-size=50`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`USACE ${res.status}`);
    const json = await res.json();
    const vals = json.values ?? [];
    const readings = [];
    if (vals.length) {
      const last = vals[vals.length - 1];
      readings.push({
        label: "Reservoir stage",
        value: Number(last[1]).toFixed(2),
        unit: json.units || "ft",
        observedAt: last[0] ? new Date(last[0]).toISOString() : "",
      });
    }
    return emptyStation(siteId, "USACE", { siteName, readings });
  } catch (err) {
    return emptyStation(siteId, "USACE", { siteName, error: String(err.message ?? err) });
  }
}

async function main() {
  const bindings = JSON.parse(readFileSync(BIND_PATH, "utf8"));
  const matched = bindings.records.filter((r) => r.status === "matched" && r.siteId);
  const stations = {};
  const byAgency = {
    USGS: { bound: 0, withReadings: 0 },
    "NOAA-COOPS": { bound: 0, withReadings: 0 },
    WSC: { bound: 0, withReadings: 0 },
    USBR: { bound: 0, withReadings: 0 },
    USACE: { bound: 0, withReadings: 0 },
    CDEC: { bound: 0, withReadings: 0 },
  };

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
  const usbrRows = [
    ...new Map(matched.filter((r) => r.agency === "USBR").map((r) => [r.siteId, r])).values(),
  ];
  const usaceRows = [
    ...new Map(matched.filter((r) => r.agency === "USACE").map((r) => [r.siteId, r])).values(),
  ];
  const cdecRows = [
    ...new Map(matched.filter((r) => r.agency === "CDEC").map((r) => [r.siteId, r])).values(),
  ];

  byAgency.USGS.bound = usgsIds.length;
  byAgency["NOAA-COOPS"].bound = noaaRows.length;
  byAgency.WSC.bound = wscRows.length;
  byAgency.USBR.bound = usbrRows.length;
  byAgency.USACE.bound = usaceRows.length;
  byAgency.CDEC.bound = cdecRows.length;

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

  const usbrResults = await poolMap(usbrRows, 3, (r) => usbrStation(r.siteId, r.siteName));
  for (const row of usbrResults) stations[row.siteId] = row;
  console.error(`usbr  ${usbrRows.length} stations`);

  const usaceResults = await poolMap(usaceRows, 3, (r) => usaceStation(r.siteId, r.siteName));
  for (const row of usaceResults) stations[row.siteId] = row;
  console.error(`usace ${usaceRows.length} stations`);

  const cdecResults = await poolMap(cdecRows, 3, (r) => cdecStation(r.siteId, r.siteName));
  for (const row of cdecResults) stations[row.siteId] = row;
  console.error(`cdec  ${cdecRows.length} stations`);

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
    source: "usgs-nwis-iv+noaa-coops+wsc-geomet+usbr-rise+usace-cwms+cdec+nws-obs",
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
      ` · WSC ${byAgency.WSC.withReadings}/${byAgency.WSC.bound}` +
      ` · USBR ${byAgency.USBR.withReadings}/${byAgency.USBR.bound}` +
      ` · USACE ${byAgency.USACE.withReadings}/${byAgency.USACE.bound}` +
      ` · CDEC ${byAgency.CDEC.withReadings}/${byAgency.CDEC.bound}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
