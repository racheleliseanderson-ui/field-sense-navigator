/**
 * Live official readings.
 *
 * Stations come from the committed binding file (name-matched, fail-closed).
 * Readings prefer the scheduled snapshot when it is fresh, then the USGS
 * instantaneous-values feed for that exact site ID. Nothing is guessed.
 */

import { bindingFor, bindingsFile, type StationBinding } from "@/lib/bindings";

const UA = "HookTheHorizon-FieldSense/0.5 (rachel.elise.anderson@gmail.com)";
const SNAPSHOT_STALE_MS = 45 * 60_000;
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/racheleliseanderson-ui/field-sense-navigator/live-snapshot/snapshot.json";

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

export interface LiveConditions {
  station: Station | null;
  readings: Reading[];
  forecast: { office: string; period: string; detail: string } | null;
  unknowns: string[];
  fetchedAt: string;
  source: "scheduled-snapshot" | "usgs-live" | "unbound";
  snapshotAgeMinutes: number | null;
  binding: {
    status: StationBinding["status"] | "missing";
    generatedAt: string;
    note: string;
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
  };
  stations: Record<
    string,
    {
      siteId: string;
      siteName: string | null;
      readings: Reading[];
      fetchedAt: string;
      error?: string;
    }
  >;
}

let snapshotCache: { at: number; data: LiveSnapshot | null } = { at: 0, data: null };

async function fetchSnapshot(url: string): Promise<LiveSnapshot | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as LiveSnapshot;
}

async function loadSnapshot(): Promise<LiveSnapshot | null> {
  const now = Date.now();
  if (now - snapshotCache.at < 60_000) return snapshotCache.data;
  const urls = [SNAPSHOT_URL, "/live/snapshot.json"];
  for (const url of urls) {
    try {
      const data = await fetchSnapshot(url);
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

export async function loadSnapshotMeta(): Promise<LiveSnapshot | null> {
  return loadSnapshot();
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
): LiveConditions {
  return {
    station: null,
    readings: [],
    forecast: null,
    unknowns,
    fetchedAt: new Date().toISOString(),
    source: "unbound",
    snapshotAgeMinutes: null,
    binding,
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
    );
  }

  const bindingMeta = {
    status: bind.status,
    generatedAt: bindingsFile.generatedAt,
    note: bind.note,
  };

  if (bind.status !== "matched" || !bind.siteId) {
    return emptyLive(
      [
        bind.note,
        "The scheduled pipeline will not invent a nearby gauge.",
        "Conditions must be verified in person or through the agency page.",
      ],
      bindingMeta,
    );
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
  let source: LiveConditions["source"] = "usgs-live";

  if (snapFresh && snapRow) {
    readings = snapRow.readings;
    source = "scheduled-snapshot";
  } else {
    readings = await usgsReadings(bind.siteId).catch(() => [] as Reading[]);
    source = "usgs-live";
    if (readings.length === 0 && snapRow?.readings.length) {
      readings = snapRow.readings;
      source = "scheduled-snapshot";
      unknowns.push(
        "The live USGS feed returned no values; showing the last scheduled snapshot instead.",
      );
    }
  }

  const forecast =
    bind.lat != null && bind.lon != null
      ? await nwsForecast(bind.lat, bind.lon).catch(() => null)
      : null;

  if (readings.length === 0) {
    unknowns.push("The matched station returned no current values; the feed may be offline.");
  }
  if (!forecast) {
    unknowns.push("No National Weather Service forecast was returned for the station location.");
  }
  unknowns.push(
    "The station is bound on published water name and type only. It may sit on a different reach or basin arm than your access — read the station name before trusting the number.",
  );
  unknowns.push("Agency observations only. Nothing here predicts fish behavior.");

  return {
    station: { id: bind.siteId, name: bind.siteName ?? bind.siteId, agency: bind.agency ?? "USGS" },
    readings,
    forecast,
    unknowns,
    fetchedAt,
    source,
    snapshotAgeMinutes: snapAge,
    binding: bindingMeta,
  };
}
