/**
 * Live official readings.
 *
 * Stations come from the committed binding file (override, then name-match).
 * Readings prefer the scheduled snapshot when it is fresh, then a live pull
 * from the bound agency. NWS observations use the station stored on the
 * binding. Closures are agency-page language, not a determination.
 */

import { bindingFor, bindingsFile, type StationBinding } from "@/lib/bindings";

const UA = "HookTheHorizon-FieldSense/0.5 (rachel.elise.anderson@gmail.com)";
const SNAPSHOT_STALE_MS = 45 * 60_000;
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/racheleliseanderson-ui/field-sense-navigator/live-snapshot/snapshot.json";
const CLOSURES_URL =
  "https://raw.githubusercontent.com/racheleliseanderson-ui/field-sense-navigator/live-snapshot/closures.json";

export interface Reading {
  label: string;
  value: string;
  unit: string;
  observedAt: string;
}

export interface Station {
  id: string;
  name: string;
  agency: string;
}

export interface NwsObservation {
  stationId: string;
  stationName: string;
  readings: Reading[];
}

export interface ClosureHit {
  term: string;
  snippet: string;
}

export interface ClosureScan {
  status: "hit" | "none" | "unreachable" | "unscanned";
  note: string;
  hits: ClosureHit[];
  scannedAt: string | null;
}

export interface LiveConditions {
  station: Station | null;
  readings: Reading[];
  forecast: { office: string; period: string; detail: string } | null;
  observation: NwsObservation | null;
  closures: ClosureScan;
  unknowns: string[];
  fetchedAt: string;
  source: "scheduled-snapshot" | "agency-live" | "unbound";
  snapshotAgeMinutes: number | null;
  binding: {
    status: StationBinding["status"] | "missing";
    generatedAt: string;
    note: string;
    source?: StationBinding["source"];
  };
}

const PARAMS: Record<string, { label: string; unit: string }> = {
  "00060": { label: "Streamflow", unit: "ft³/s" },
  "00065": { label: "Gage height", unit: "ft" },
  "00010": { label: "Water temperature", unit: "°C" },
  "62614": { label: "Lake or reservoir elevation", unit: "ft" },
};

export interface LiveSnapshot {
  schema: string;
  ingestedAt: string;
  source: string;
  cadenceMinutes: number;
  doctrine: string;
  stats: {
    boundStations: number;
    withReadings: number;
    emptyOrError: number;
    destinationBindings: number;
    byAgency?: Record<string, { bound: number; withReadings: number }>;
    nwsStations?: number;
    nwsWithObs?: number;
  };
  stations: Record<
    string,
    {
      siteId: string;
      agency?: string;
      siteName: string | null;
      readings: Reading[];
      fetchedAt: string;
      error?: string;
    }
  >;
  observations?: Record<
    string,
    {
      stationId: string;
      stationName: string;
      readings: Reading[];
      fetchedAt: string;
      error?: string;
    }
  >;
}

export interface ClosureFile {
  scannedAt: string;
  stats: { scanned: number; hit: number; none: number; unreachable: number };
  records: Record<
    string,
    {
      status: "hit" | "none" | "unreachable";
      note: string;
      hits: ClosureHit[];
    }
  >;
}

let snapshotCache: { at: number; data: LiveSnapshot | null } = { at: 0, data: null };
let closureCache: { at: number; data: ClosureFile | null } = { at: 0, data: null };

async function fetchJson<T>(url: string, extraHeaders: Record<string, string> = {}): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...extraHeaders },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function loadSnapshot(): Promise<LiveSnapshot | null> {
  const now = Date.now();
  if (now - snapshotCache.at < 60_000) return snapshotCache.data;
  for (const url of [SNAPSHOT_URL, "/live/snapshot.json"]) {
    try {
      const data = await fetchJson<LiveSnapshot>(url);
      if (data?.ingestedAt && data.stations) {
        snapshotCache = { at: now, data };
        return data;
      }
    } catch {
      /* try the next source */
    }
  }
  snapshotCache = { at: now, data: null };
  return null;
}

async function loadClosures(): Promise<ClosureFile | null> {
  const now = Date.now();
  if (now - closureCache.at < 60_000) return closureCache.data;
  for (const url of [CLOSURES_URL, "/live/closures.json"]) {
    try {
      const data = await fetchJson<ClosureFile>(url);
      if (data?.scannedAt && data.records) {
        closureCache = { at: now, data };
        return data;
      }
    } catch {
      /* try next */
    }
  }
  closureCache = { at: now, data: null };
  return null;
}

export async function loadSnapshotMeta(): Promise<LiveSnapshot | null> {
  return loadSnapshot();
}

export async function loadClosureMeta(): Promise<ClosureFile | null> {
  return loadClosures();
}

async function usgsReadings(siteId: string): Promise<Reading[]> {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    value?: {
      timeSeries?: Array<{
        variable?: { variableCode?: Array<{ value?: string }> };
        values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
      }>;
    };
  };
  const out: Reading[] = [];
  for (const ts of json.value?.timeSeries ?? []) {
    const code = ts.variable?.variableCode?.[0]?.value ?? "";
    const meta = PARAMS[code];
    const point = ts.values?.[0]?.value?.slice(-1)[0];
    if (!meta || !point?.value || point.value === "-999999") continue;
    out.push({
      label: meta.label,
      value: point.value,
      unit: meta.unit,
      observedAt: point.dateTime ?? "",
    });
  }
  return out;
}

function noaaIso(t?: string) {
  if (!t) return "";
  return t.includes("T") ? t : `${t.replace(" ", "T")}Z`;
}

async function noaaReadings(siteId: string): Promise<Reading[]> {
  const out: Reading[] = [];
  const base =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?date=latest&station=${siteId}&time_zone=gmt&units=english` +
    `&application=HookTheHorizon&format=json`;
  const level = await fetchJson<{ data?: Array<{ v?: string; t?: string }> }>(
    `${base}&product=water_level&datum=MLLW`,
  );
  if (level?.data?.[0]?.v) {
    out.push({
      label: "Water level (MLLW)",
      value: level.data[0].v,
      unit: "ft",
      observedAt: noaaIso(level.data[0].t),
    });
  }
  const wind = await fetchJson<{
    data?: Array<{ s?: string; dr?: string; t?: string }>;
  }>(`${base}&product=wind`);
  if (wind?.data?.[0]?.s) {
    const dir = wind.data[0].dr ? ` ${wind.data[0].dr}` : "";
    out.push({
      label: "Wind",
      value: `${Number(wind.data[0].s).toFixed(1)}${dir}`,
      unit: "mph",
      observedAt: noaaIso(wind.data[0].t),
    });
  }
  return out;
}

async function wscReadings(siteId: string): Promise<Reading[]> {
  const json = await fetchJson<{
    features?: Array<{
      properties?: { DISCHARGE?: number; LEVEL?: number; DATETIME?: string };
    }>;
  }>(
    `https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json&limit=1&STATION_NUMBER=${encodeURIComponent(siteId)}&sortby=-DATETIME`,
  );
  const p = json?.features?.[0]?.properties;
  const out: Reading[] = [];
  if (p?.DISCHARGE != null) {
    out.push({
      label: "Discharge",
      value: String(p.DISCHARGE),
      unit: "m³/s",
      observedAt: p.DATETIME ?? "",
    });
  }
  if (p?.LEVEL != null) {
    out.push({
      label: "Water level",
      value: String(p.LEVEL),
      unit: "m",
      observedAt: p.DATETIME ?? "",
    });
  }
  return out;
}

function cdecIso(t?: string) {
  if (!t) return "";
  const m = String(t).match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const pad = (n: string) => n.padStart(2, "0");
  return `${m[1]}-${pad(m[2] ?? "")}-${pad(m[3] ?? "")}T${pad(m[4] ?? "")}:${m[5]}:00`;
}

function cdecLatest(
  rows: Array<{ value?: number | string; obsDate?: string; date?: string; sensorType?: string; units?: string }>,
) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const v = Number(row?.value);
    if (Number.isFinite(v) && v !== -9999) {
      return { value: String(row?.value), at: cdecIso(row?.obsDate || row?.date) };
    }
  }
  return null;
}

async function cdecReadings(siteId: string): Promise<Reading[]> {
  const url =
    `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=${encodeURIComponent(siteId)}` +
    `&SensorNums=6,15&dur_code=D&count=5`;
  const json = await fetchJson<
    Array<{ value?: number; obsDate?: string; date?: string; sensorType?: string; units?: string; SENSOR_NUM?: number }>
  >(url);
  if (!Array.isArray(json)) return [];
  const elev = cdecLatest(json.filter((r) => r.SENSOR_NUM === 6 || /ELE/i.test(r.sensorType ?? "")));
  const store = cdecLatest(json.filter((r) => r.SENSOR_NUM === 15 || /STOR/i.test(r.sensorType ?? "")));
  const out: Reading[] = [];
  if (elev) out.push({ label: "Reservoir elevation", value: elev.value, unit: "ft", observedAt: elev.at });
  if (store) out.push({ label: "Reservoir storage", value: store.value, unit: "ac-ft", observedAt: store.at });
  return out;
}

async function usbrRiseLatest(itemId: string): Promise<{ value: string; at: string } | null> {
  const since = new Date(Date.now() - 40 * 86400_000).toISOString().slice(0, 10);
  const json = await fetchJson<{
    data?: Array<{ attributes?: { dateTime?: string; result?: number } }>;
  }>(
    `https://data.usbr.gov/rise/api/result?filter[itemId]=${encodeURIComponent(itemId)}` +
      `&filter[dateTime][GT]=${since}&page[size]=5`,
    { Accept: "application/vnd.api+json" },
  );
  const a = json?.data?.[0]?.attributes;
  if (a?.result == null) return null;
  return { value: String(a.result), at: a.dateTime ?? "" };
}

async function usbrHydrometFb(code: string): Promise<{ value: string; at: string } | null> {
  const now = new Date();
  const start = new Date(now.getTime() - 16 * 86400_000);
  const q =
    `parameter=${encodeURIComponent(code.toUpperCase() + " FB")}` +
    `&syer=${start.getUTCFullYear()}&smnth=${start.getUTCMonth() + 1}&sdy=${start.getUTCDate()}` +
    `&eyer=${now.getUTCFullYear()}&emnth=${now.getUTCMonth() + 1}&edy=${now.getUTCDate()}&format=2`;
  const res = await fetch(`https://www.usbr.gov/pn-bin/webarccsv.pl?${q}`, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => /^\d{2}\/\d{2}\/\d{4},/.test(l));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const [d, v] = (lines[i] ?? "").split(",");
    const n = Number(String(v).trim());
    if (!Number.isFinite(n)) continue;
    const [mm, dd, yy] = (d ?? "").split("/");
    return { value: String(n), at: `${yy}-${mm}-${dd}T00:00:00Z` };
  }
  return null;
}

async function usbrReadings(siteId: string): Promise<Reading[]> {
  if (siteId.startsWith("rise:")) {
    const hit = await usbrRiseLatest(siteId.slice(5));
    return hit
      ? [{ label: "Reservoir elevation", value: hit.value, unit: "ft", observedAt: hit.at }]
      : [];
  }
  const hit = await usbrHydrometFb(siteId);
  return hit
    ? [{ label: "Reservoir elevation", value: hit.value, unit: "ft", observedAt: hit.at }]
    : [];
}

async function usaceReadings(siteId: string): Promise<Reading[]> {
  const parts = siteId.includes(":") ? siteId.split(":") : ["SAS", siteId];
  const office = parts[0] ?? "SAS";
  const name = parts[1] ?? siteId;
  const end = new Date();
  const begin = new Date(end.getTime() - 10 * 86400_000);
  const url =
    `https://cwms-data.usace.army.mil/cwms-data/timeseries?office=${encodeURIComponent(office)}` +
    `&name=${encodeURIComponent(name)}` +
    `&begin=${begin.toISOString()}&end=${end.toISOString()}&page-size=20`;
  const json = await fetchJson<{
    units?: string;
    values?: Array<[number, number, number]>;
  }>(url);
  const vals = json?.values ?? [];
  if (!vals.length) return [];
  const last = vals[vals.length - 1];
  if (!last) return [];
  const observedAt = last[0] ? new Date(last[0]).toISOString() : "";
  return [
    {
      label: "Reservoir stage",
      value: Number(last[1]).toFixed(2),
      unit: json?.units || "ft",
      observedAt,
    },
  ];
}

async function liveReadings(agency: string | null, siteId: string): Promise<Reading[]> {
  if (agency === "NOAA-COOPS") return noaaReadings(siteId);
  if (agency === "WSC") return wscReadings(siteId);
  if (agency === "CDEC") return cdecReadings(siteId);
  if (agency === "USBR") return usbrReadings(siteId);
  if (agency === "USACE") return usaceReadings(siteId);
  return usgsReadings(siteId);
}

async function nwsForecast(lat: number, lon: number) {
  try {
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { "User-Agent": UA, Accept: "application/geo+json" } },
    );
    if (!pointRes.ok) return null;
    const point = (await pointRes.json()) as {
      properties?: { forecast?: string; gridId?: string };
    };
    const url = point.properties?.forecast;
    if (!url) return null;
    const fRes = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/geo+json" },
    });
    if (!fRes.ok) return null;
    const f = (await fRes.json()) as {
      properties?: { periods?: Array<{ name?: string; detailedForecast?: string }> };
    };
    const p = f.properties?.periods?.[0];
    if (!p?.detailedForecast) return null;
    return {
      office: point.properties?.gridId ?? "NWS",
      period: p.name ?? "Current period",
      detail: p.detailedForecast,
    };
  } catch {
    return null;
  }
}

function emptyLive(
  unknowns: string[],
  binding: LiveConditions["binding"],
  closures: ClosureScan,
): LiveConditions {
  return {
    station: null,
    readings: [],
    forecast: null,
    observation: null,
    closures,
    unknowns,
    fetchedAt: new Date().toISOString(),
    source: "unbound",
    snapshotAgeMinutes: null,
    binding,
  };
}

function closureFor(id: string | undefined, file: ClosureFile | null): ClosureScan {
  if (!id || !file) {
    return {
      status: "unscanned",
      note: "Agency-page closure language has not been scanned yet.",
      hits: [],
      scannedAt: file?.scannedAt ?? null,
    };
  }
  const row = file.records[id];
  if (!row) {
    return {
      status: "unscanned",
      note: "This water was not in the last closure scan.",
      hits: [],
      scannedAt: file.scannedAt,
    };
  }
  return {
    status: row.status,
    note: row.note,
    hits: row.hits ?? [],
    scannedAt: file.scannedAt,
  };
}

export async function readLive(input: {
  id?: string;
  state: string;
  waterbody: string;
}): Promise<LiveConditions> {
  const fetchedAt = new Date().toISOString();
  const bind = input.id
    ? bindingFor(input.id)
    : bindingsFile.records.find(
        (r) => r.state === input.state && r.waterbody === input.waterbody,
      );

  const closuresFile = await loadClosures();
  const closures = closureFor(input.id ?? bind?.destinationId, closuresFile);

  if (!bind) {
    return emptyLive(
      [
        "This water has no station binding yet. It will be resolved on the next scheduled resolve run.",
        "Conditions must be verified in person or through the agency page.",
      ],
      {
        status: "missing",
        generatedAt: bindingsFile.generatedAt,
        note: "No binding row.",
      },
      closures,
    );
  }

  const bindingMeta = {
    status: bind.status,
    generatedAt: bindingsFile.generatedAt,
    note: bind.note,
    source: bind.source,
  };

  if (bind.status !== "matched" || !bind.siteId) {
    const unknowns = [
      bind.note,
      "The scheduled pipeline will not invent a nearby gauge.",
    ];
    const snapshot = await loadSnapshot();
    const snapAge = snapshot
      ? Math.max(0, Math.round((Date.now() - new Date(snapshot.ingestedAt).getTime()) / 60000))
      : null;
    const snapFresh =
      snapshot &&
      Number.isFinite(new Date(snapshot.ingestedAt).getTime()) &&
      Date.now() - new Date(snapshot.ingestedAt).getTime() < SNAPSHOT_STALE_MS;

    let observation: NwsObservation | null = null;
    if (bind.nwsStationId) {
      const snapObs = snapshot?.observations?.[bind.nwsStationId];
      if (snapObs && snapObs.readings.length > 0 && snapFresh) {
        observation = {
          stationId: snapObs.stationId,
          stationName: snapObs.stationName,
          readings: snapObs.readings,
        };
      }
    }
    const forecast =
      bind.lat != null && bind.lon != null
        ? await nwsForecast(bind.lat, bind.lon).catch(() => null)
        : null;
    if (!bind.nwsStationId) {
      unknowns.push("No official weather observation station is bound to this record.");
    } else if (!observation) {
      unknowns.push(
        `Observation station ${bind.nwsStationId} is bound but returned no current values.`,
      );
    }
    if (!forecast) {
      unknowns.push("No official forecast was returned for this water's published location.");
    }
    unknowns.push("Conditions must be verified in person or through the agency page.");
    return {
      station: null,
      readings: [],
      forecast,
      observation,
      closures,
      unknowns,
      fetchedAt,
      source: "unbound",
      snapshotAgeMinutes: snapAge,
      binding: bindingMeta,
    };
  }

  const unknowns: string[] = [];
  const snapshot = await loadSnapshot();
  const snapRow = snapshot?.stations[bind.siteId];
  const snapAge = snapshot
    ? Math.max(0, Math.round((Date.now() - new Date(snapshot.ingestedAt).getTime()) / 60000))
    : null;
  const snapFresh =
    snapshot &&
    Number.isFinite(new Date(snapshot.ingestedAt).getTime()) &&
    Date.now() - new Date(snapshot.ingestedAt).getTime() < SNAPSHOT_STALE_MS &&
    snapRow &&
    snapRow.readings.length > 0;

  let readings: Reading[] = [];
  let source: LiveConditions["source"] = "agency-live";

  if (snapFresh && snapRow) {
    readings = snapRow.readings;
    source = "scheduled-snapshot";
  } else {
    readings = await liveReadings(bind.agency, bind.siteId).catch(() => [] as Reading[]);
    source = "agency-live";
    if (readings.length === 0 && snapRow?.readings.length) {
      readings = snapRow.readings;
      source = "scheduled-snapshot";
      unknowns.push(
        "The live agency feed returned no values; showing the last scheduled snapshot instead.",
      );
    }
  }

  let observation: NwsObservation | null = null;
  if (bind.nwsStationId) {
    const snapObs = snapshot?.observations?.[bind.nwsStationId];
    if (snapObs && snapObs.readings.length > 0 && snapFresh) {
      observation = {
        stationId: snapObs.stationId,
        stationName: snapObs.stationName,
        readings: snapObs.readings,
      };
    }
  }

  const forecast =
    bind.lat != null && bind.lon != null
      ? await nwsForecast(bind.lat, bind.lon).catch(() => null)
      : null;

  if (readings.length === 0) {
    unknowns.push("The matched station returned no current values; the feed may be offline.");
  }
  if (bind.nwsStationId && !observation) {
    unknowns.push(
      `NWS observation station ${bind.nwsStationId} is bound but returned no current values.`,
    );
  }
  if (!bind.nwsStationId) {
    unknowns.push("No NWS observation station is bound to this record.");
  }
  if (!forecast) {
    unknowns.push("No National Weather Service forecast was returned for the station location.");
  }
  unknowns.push(
    bind.source === "override"
      ? "This station was pinned in the override file. Confirm the reach before trusting the number."
      : "The station is bound on published water name and type only. It may sit on a different reach or basin arm than your access — read the station name before trusting the number.",
  );
  unknowns.push("Agency observations only. Nothing here predicts fish behavior.");

  return {
    station: {
      id: bind.siteId,
      name: bind.siteName ?? bind.siteId,
      agency: bind.agency ?? "USGS",
    },
    readings,
    forecast,
    observation,
    closures,
    unknowns,
    fetchedAt,
    source,
    snapshotAgeMinutes: snapAge,
    binding: bindingMeta,
  };
}
