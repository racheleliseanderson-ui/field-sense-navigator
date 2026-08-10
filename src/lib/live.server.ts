/**
 * Live official readings.
 *
 * Stations are resolved against the USGS site inventory for the record's
 * state and matched on published water name. Nothing is guessed: if no
 * official station carries a matching name, the record says so.
 */

const STATE_CODE: Record<string, string> = {
  Alabama: "al", Alaska: "ak", Arizona: "az", Arkansas: "ar", California: "ca",
  Colorado: "co", Connecticut: "ct", Delaware: "de", Florida: "fl", Georgia: "ga",
  Hawaii: "hi", Idaho: "id", Illinois: "il", Indiana: "in", Iowa: "ia",
  Kansas: "ks", Kentucky: "ky", Louisiana: "la", Maine: "me", Maryland: "md",
  Massachusetts: "ma", Michigan: "mi", Minnesota: "mn", Mississippi: "ms",
  Missouri: "mo", Montana: "mt", Nebraska: "ne", Nevada: "nv",
  "New Hampshire": "nh", "New Jersey": "nj", "New Mexico": "nm", "New York": "ny",
  "North Carolina": "nc", "North Dakota": "nd", Ohio: "oh", Oklahoma: "ok",
  Oregon: "or", Pennsylvania: "pa", "Rhode Island": "ri", "South Carolina": "sc",
  "South Dakota": "sd", Tennessee: "tn", Texas: "tx", Utah: "ut", Vermont: "vt",
  Virginia: "va", Washington: "wa", "West Virginia": "wv", Wisconsin: "wi",
  Wyoming: "wy",
};

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
}

const PARAMS: Record<string, { label: string; unit: string }> = {
  "00060": { label: "Streamflow", unit: "ft³/s" },
  "00065": { label: "Gage height", unit: "ft" },
  "00010": { label: "Water temperature", unit: "°C" },
  "62614": { label: "Lake or reservoir elevation", unit: "ft" },
};

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const STOP = new Set([
  "lake", "river", "reservoir", "bay", "creek", "pond", "the", "of", "north",
  "south", "east", "west", "upper", "lower", "waters", "state", "park",
]);

/** Score a USGS station name against the published waterbody name. */
function nameScore(water: string, station: string): number {
  const w = norm(water).split(" ").filter((x) => x.length > 2 && !STOP.has(x));
  if (w.length === 0) return 0;
  const s = norm(station);
  let hit = 0;
  for (const term of w) if (s.includes(term)) hit++;
  return hit / w.length;
}

interface SiteRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

async function stateSites(code: string): Promise<SiteRow[]> {
  const url =
    `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active&siteType=ST,LK,ES`;
  const res = await fetch(url, { headers: { "User-Agent": "honey-hole-intelligence" } });
  if (!res.ok) return [];
  const text = await res.text();
  const rows: SiteRow[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 7 || cols[0] !== "USGS") continue;
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    if (!cols[1] || !cols[2]) continue;
    rows.push({ id: cols[1], name: cols[2], lat, lon });
  }
  return rows;
}

async function usgsReadings(siteId: string): Promise<Reading[]> {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active`;
  const res = await fetch(url, { headers: { "User-Agent": "honey-hole-intelligence" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    value?: { timeSeries?: Array<{
      variable?: { variableCode?: Array<{ value?: string }> };
      values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
    }> };
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
      { headers: { "User-Agent": "honey-hole-intelligence", Accept: "application/geo+json" } },
    );
    if (!pointRes.ok) return null;
    const point = (await pointRes.json()) as {
      properties?: { forecast?: string; gridId?: string };
    };
    const url = point.properties?.forecast;
    if (!url) return null;
    const fRes = await fetch(url, {
      headers: { "User-Agent": "honey-hole-intelligence", Accept: "application/geo+json" },
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

export async function readLive(
  state: string,
  waterbody: string,
): Promise<LiveConditions> {
  const fetchedAt = new Date().toISOString();
  const unknowns: string[] = [];
  const code = STATE_CODE[state];
  if (!code) {
    return {
      station: null, readings: [], forecast: null, fetchedAt,
      unknowns: ["No official station index is available for this state."],
    };
  }

  let sites: SiteRow[] = [];
  try {
    sites = await stateSites(code);
  } catch {
    return {
      station: null, readings: [], forecast: null, fetchedAt,
      unknowns: ["The USGS site index could not be reached. Treat this water as unmonitored for now."],
    };
  }

  let best: { row: SiteRow; score: number } | null = null;
  for (const row of sites) {
    const score = nameScore(waterbody, row.name);
    if (score >= 0.75 && (!best || score > best.score)) best = { row, score };
  }

  if (!best) {
    return {
      station: null, readings: [], forecast: null, fetchedAt,
      unknowns: [
        "No USGS station publishes under this waterbody's name. No nearby station is substituted.",
        "Conditions must be verified in person or through the agency page.",
      ],
    };
  }

  const [readings, forecast] = await Promise.all([
    usgsReadings(best.row.id).catch(() => [] as Reading[]),
    nwsForecast(best.row.lat, best.row.lon).catch(() => null),
  ]);

  if (readings.length === 0) {
    unknowns.push("The matched station returned no current values; the feed may be offline.");
  }
  if (!forecast) {
    unknowns.push("No National Weather Service forecast was returned for the station location.");
  }
  unknowns.push("Agency observations only. Nothing here predicts fish behavior.");

  return {
    station: { id: best.row.id, name: best.row.name, agency: "USGS" },
    readings,
    forecast,
    unknowns,
    fetchedAt,
  };
}
