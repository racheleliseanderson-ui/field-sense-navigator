/**
 * Live official readings — STRICTLY opt-in, explicit station IDs only.
 *
 * Never name-matches or guesses a station. If the record carries no
 * usgsSiteId / noaaCoopsStationId / ndbcBuoyId, the response states that
 * no station is mapped. Readings are raw attributed sensor values only;
 * nothing here is a bite, hatch or behaviour forecast.
 */

export interface Reading {
  label: string;
  value: string;
  unit: string;
  observedAt: string;
  sourceId: string;
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
  attribution: string[];
}

const USGS_PARAMS: Record<string, { label: string; unit: string }> = {
  "00060": { label: "Streamflow", unit: "ft³/s" },
  "00065": { label: "Gage height", unit: "ft" },
  "00010": { label: "Water temperature", unit: "°C" },
  "62614": { label: "Lake or reservoir elevation", unit: "ft" },
};

const MAX_AGE_HOURS = 6;

function isFresh(iso: string, maxHours = MAX_AGE_HOURS): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < maxHours * 3_600_000;
}

async function usgsReadings(siteId: string): Promise<{ station: Station; readings: Reading[] } | null> {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${encodeURIComponent(siteId)}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active`;
  const res = await fetch(url, {
    headers: { "User-Agent": "field-sense-navigator (rachel.elise.anderson@gmail.com)" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    value?: {
      timeSeries?: Array<{
        sourceInfo?: { siteName?: string; siteCode?: Array<{ value?: string }> };
        variable?: { variableCode?: Array<{ value?: string }> };
        values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
      }>;
    };
  };
  const series = json.value?.timeSeries ?? [];
  if (series.length === 0) return null;
  const siteName = series[0]?.sourceInfo?.siteName ?? `USGS ${siteId}`;
  const readings: Reading[] = [];
  for (const ts of series) {
    const code = ts.variable?.variableCode?.[0]?.value ?? "";
    const meta = USGS_PARAMS[code];
    const point = ts.values?.[0]?.value?.slice(-1)[0];
    if (!meta || !point?.value || point.value === "-999999") continue;
    if (point.dateTime && !isFresh(point.dateTime)) continue;
    readings.push({
      label: meta.label,
      value: point.value,
      unit: meta.unit,
      observedAt: point.dateTime ?? "",
      sourceId: siteId,
    });
  }
  return {
    station: { id: siteId, name: siteName, agency: "USGS" },
    readings,
  };
}

async function coopsReadings(stationId: string): Promise<{ station: Station; readings: Reading[] } | null> {
  const products = ["water_level", "wind", "air_pressure"];
  const readings: Reading[] = [];
  let name = `CO-OPS ${stationId}`;
  for (const product of products) {
    try {
      const url =
        `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
        `date=latest&station=${encodeURIComponent(stationId)}&product=${product}` +
        `&datum=MLLW&time_zone=lst_ldt&units=english&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "field-sense-navigator (rachel.elise.anderson@gmail.com)" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        metadata?: { name?: string; id?: string };
        data?: Array<Record<string, string>>;
      };
      if (json.metadata?.name) name = json.metadata.name;
      const row = json.data?.[0];
      if (!row) continue;
      const t = row.t ?? row.time ?? "";
      if (t && !isFresh(t.replace(" ", "T"))) continue;
      if (product === "water_level" && row.v) {
        readings.push({
          label: "Water level",
          value: row.v,
          unit: "ft MLLW",
          observedAt: t,
          sourceId: stationId,
        });
      } else if (product === "wind" && (row.s || row.g)) {
        if (row.s)
          readings.push({
            label: "Wind speed",
            value: row.s,
            unit: "kt",
            observedAt: t,
            sourceId: stationId,
          });
        if (row.g)
          readings.push({
            label: "Wind gust",
            value: row.g,
            unit: "kt",
            observedAt: t,
            sourceId: stationId,
          });
      } else if (product === "air_pressure" && row.v) {
        readings.push({
          label: "Barometric pressure",
          value: row.v,
          unit: "mb",
          observedAt: t,
          sourceId: stationId,
        });
      }
    } catch {
      // fail closed per product
    }
  }
  if (readings.length === 0) return null;
  return {
    station: { id: stationId, name, agency: "NOAA CO-OPS" },
    readings,
  };
}

async function ndbcOrOpenMeteo(buoyId: string | null): Promise<{ readings: Reading[]; attribution: string[] }> {
  const readings: Reading[] = [];
  const attribution: string[] = [];
  if (buoyId) {
    try {
      const url = `https://www.ndbc.noaa.gov/data/realtime2/${encodeURIComponent(buoyId)}.txt`;
      const res = await fetch(url, {
        headers: { "User-Agent": "field-sense-navigator (rachel.elise.anderson@gmail.com)" },
      });
      if (res.ok) {
        attribution.push("NDBC");
      }
    } catch {
      // ignore
    }
  }
  return { readings, attribution };
}

export interface StationIds {
  usgsSiteId?: string | null;
  noaaCoopsStationId?: string | null;
  ndbcBuoyId?: string | null;
  waterbody: string;
  state: string;
}

export async function readLive(ids: StationIds): Promise<LiveConditions> {
  const fetchedAt = new Date().toISOString();
  const unknowns: string[] = [];
  const attribution: string[] = [];
  let station: Station | null = null;
  let readings: Reading[] = [];

  const hasAny =
    (ids.usgsSiteId && ids.usgsSiteId.trim()) ||
    (ids.noaaCoopsStationId && ids.noaaCoopsStationId.trim()) ||
    (ids.ndbcBuoyId && ids.ndbcBuoyId.trim());

  if (!hasAny) {
    return {
      station: null,
      readings: [],
      forecast: null,
      fetchedAt,
      unknowns: [
        "No official station ID is mapped to this record. Nothing is substituted from a nearby gauge.",
        "Conditions must be verified in person or through the agency page.",
        "Agency observations only. Nothing here predicts fish behavior.",
      ],
      attribution: [],
    };
  }

  if (ids.usgsSiteId?.trim()) {
    try {
      const u = await usgsReadings(ids.usgsSiteId.trim());
      if (u) {
        station = u.station;
        readings = u.readings;
        attribution.push("USGS Water Services");
      } else {
        unknowns.push(`USGS site ${ids.usgsSiteId} returned no current values or is unreachable.`);
      }
    } catch {
      unknowns.push(`USGS site ${ids.usgsSiteId} could not be reached.`);
    }
  }

  if (ids.noaaCoopsStationId?.trim()) {
    try {
      const c = await coopsReadings(ids.noaaCoopsStationId.trim());
      if (c) {
        if (!station) station = c.station;
        readings = [...readings, ...c.readings];
        attribution.push("NOAA CO-OPS");
      } else {
        unknowns.push(`NOAA CO-OPS station ${ids.noaaCoopsStationId} returned no current values.`);
      }
    } catch {
      unknowns.push(`NOAA CO-OPS station ${ids.noaaCoopsStationId} could not be reached.`);
    }
  }

  if (ids.ndbcBuoyId?.trim()) {
    const m = await ndbcOrOpenMeteo(ids.ndbcBuoyId.trim());
    readings = [...readings, ...m.readings];
    attribution.push(...m.attribution);
  }

  if (readings.length === 0) {
    unknowns.push("Mapped stations returned no fresh values within the max-age window. Treat as unavailable.");
  }

  unknowns.push("Agency observations only. Nothing here predicts fish behavior.");
  unknowns.push("Station IDs are explicit on the record. No nearest-station substitution is performed.");

  return {
    station,
    readings,
    forecast: null,
    unknowns,
    fetchedAt,
    attribution: [...new Set(attribution)],
  };
}
