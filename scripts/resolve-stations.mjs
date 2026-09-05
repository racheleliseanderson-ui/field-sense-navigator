#!/usr/bin/env node
/**
 * Nightly / on-demand station resolver.
 *
 * Order of truth:
 *   1. Human overrides (station-overrides.json)
 *   2. Catalog-declared usgsSiteId / noaaCoopsStationId
 *   3. USGS NWIS name match (US waters) — stream + lake indexes
 *   3b. USGS site-name search for remaining unmatched US waters
 *   4. NOAA CO-OPS name match (marine, Great Lakes, named harbors)
 *   5. Water Survey of Canada name match (provinces)
 *   6. Gazetteer location + NWS observation station on EVERY located water
 *
 * Phrase + water-type must align. No nearby substitution.
 * Same-water multi-reach is disclosed, not rejected.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bestMatches, pickUnique, searchQueries } from "./match.mjs";

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
const DEST_PATH = resolve(ROOT, "src/data/destinations.json");
const OVERRIDE_PATH = resolve(ROOT, "src/data/station-overrides.json");
const LOC_PATH = resolve(ROOT, "src/data/locations.json");
const OUT_PATH = resolve(ROOT, "src/data/station-bindings.json");

// Agencies use this to reach whoever is generating the traffic. A private
// address does not belong in a public repository or in a header sent to five
// federal and provincial agencies on every run.
const CONTACT =
  process.env.AGENCY_CONTACT_URL || "https://northernlanternhouse.com/customer-support";
const UA = `HookTheHorizon-FieldSense/0.5 (+https://waterways.hookthehorizon.blog; contact ${CONTACT})`;
const MATCH_FLOOR = 0.75;

const STATE_CODE = {
  Alabama: "al",
  Alaska: "ak",
  Arizona: "az",
  Arkansas: "ar",
  California: "ca",
  Colorado: "co",
  Connecticut: "ct",
  Delaware: "de",
  Florida: "fl",
  Georgia: "ga",
  Hawaii: "hi",
  Idaho: "id",
  Illinois: "il",
  Indiana: "in",
  Iowa: "ia",
  Kansas: "ks",
  Kentucky: "ky",
  Louisiana: "la",
  Maine: "me",
  Maryland: "md",
  Massachusetts: "ma",
  Michigan: "mi",
  Minnesota: "mn",
  Mississippi: "ms",
  Missouri: "mo",
  Montana: "mt",
  Nebraska: "ne",
  Nevada: "nv",
  "New Hampshire": "nh",
  "New Jersey": "nj",
  "New Mexico": "nm",
  "New York": "ny",
  "North Carolina": "nc",
  "North Dakota": "nd",
  Ohio: "oh",
  Oklahoma: "ok",
  Oregon: "or",
  Pennsylvania: "pa",
  "Rhode Island": "ri",
  "South Carolina": "sc",
  "South Dakota": "sd",
  Tennessee: "tn",
  Texas: "tx",
  Utah: "ut",
  Vermont: "vt",
  Virginia: "va",
  Washington: "wa",
  "West Virginia": "wv",
  Wisconsin: "wi",
  Wyoming: "wy",
};

const STATE_ABBR = Object.fromEntries(
  Object.entries(STATE_CODE).map(([k, v]) => [k, v.toUpperCase()]),
);

const PROV_CODE = {
  Alberta: "AB",
  "British Columbia": "BC",
  Manitoba: "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  Nunavut: "NU",
  Ontario: "ON",
  "Prince Edward Island": "PE",
  Quebec: "QC",
  Saskatchewan: "SK",
  Yukon: "YT",
};

const MARINE_NAME = /\b(bay|inlet|sound|harbor|harbour|gulf|ocean|lagoon|pass|strait|pier)\b/i;
const GREAT_LAKES =
  /\b(lake michigan|lake erie|lake huron|lake superior|lake ontario|lake st\.? ?clair|saginaw bay)\b/i;

/** Same-name official stations exist, but none can be defended as THIS record. */
const DENY_AUTO = new Set([
  "HHI-DEST-202", // Guadalupe River State Park ≠ Hunt / Sattler / Gonzales
  "HHI-DEST-251", // Sacramento–San Joaquin Delta ≠ Sacramento R at Delta, CA
]);

function emptyRow(d, extra) {
  return {
    destinationId: d.id,
    state: d.state,
    waterbody: d.waterbody,
    waterType: d.waterType,
    status: extra.status,
    agency: extra.agency ?? null,
    siteId: extra.siteId ?? null,
    siteName: extra.siteName ?? null,
    lat: extra.lat ?? null,
    lon: extra.lon ?? null,
    score: extra.score ?? 0,
    source: extra.source ?? "name-match",
    nwsStationId: extra.nwsStationId ?? null,
    nwsStationName: extra.nwsStationName ?? null,
    note: extra.note,
  };
}

async function usgsNameSearch(code, water) {
  const queries = searchQueries(water);
  const byId = new Map();
  for (const q of queries) {
    const urls = [
      `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}` +
        `&siteName=${encodeURIComponent(q)}&siteNameMatchOperator=ANY&siteStatus=all&siteType=ST,LK,ES,OC`,
      `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}` +
        `&siteName=${encodeURIComponent(q)}&siteNameMatchOperator=ANY&siteStatus=all`,
    ];
    for (const url of urls) {
      try {
        const text = await fetchText(url);
        for (const line of text.split("\n")) {
          if (!line || line.startsWith("#")) continue;
          const cols = line.split("\t");
          if (cols.length < 6 || cols[0] !== "USGS") continue;
          if (!cols[1] || !cols[2]) continue;
          byId.set(cols[1], {
            id: cols[1],
            name: cols[2],
            lat: Number(cols[4]),
            lon: Number(cols[5]),
          });
        }
        break;
      } catch {
        /* next */
      }
    }
  }
  return [...byId.values()];
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function usgsStateSites(code) {
  const urls = [
    `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}` +
      `&parameterCd=00060,00065,00010,62614,62615,00062,72020&siteStatus=active&siteType=ST,LK,ES,OC`,
    `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}&siteType=LK&siteStatus=active`,
  ];
  const byId = new Map();
  let lastErr = null;
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      for (const line of text.split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const cols = line.split("\t");
        if (cols.length < 7 || cols[0] !== "USGS") continue;
        if (!cols[1] || !cols[2]) continue;
        if (byId.has(cols[1])) continue;
        byId.set(cols[1], {
          id: cols[1],
          name: cols[2],
          lat: Number(cols[4]),
          lon: Number(cols[5]),
        });
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (!byId.size && lastErr) throw lastErr;
  return [...byId.values()];
}

async function noaaStations() {
  const json = await fetchJson(
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels",
  );
  return (json.stations ?? []).map((s) => ({
    id: String(s.id),
    name: s.name,
    state: s.state,
    lat: Number(s.lat),
    lon: Number(s.lng),
    greatlakes: Boolean(s.greatlakes),
  }));
}

async function wscStations() {
  const out = [];
  let offset = 0;
  for (;;) {
    const url =
      `https://api.weather.gc.ca/collections/hydrometric-stations/items` +
      `?f=json&limit=1000&offset=${offset}&STATUS_EN=Active`;
    const json = await fetchJson(url);
    const batch = json.features ?? [];
    for (const f of batch) {
      const p = f.properties ?? {};
      const coords = f.geometry?.coordinates;
      out.push({
        id: p.STATION_NUMBER,
        name: p.STATION_NAME,
        prov: p.PROV_TERR_STATE_LOC,
        realtime: p.REAL_TIME === 1 || p.REAL_TIME === "1",
        lat: Array.isArray(coords) ? Number(coords[1]) : null,
        lon: Array.isArray(coords) ? Number(coords[0]) : null,
      });
    }
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return out;
}

const nwsCache = new Map();

async function nwsObservationStation(lat, lon) {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { id: null, name: null };
  }
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

async function attachNws(row) {
  if (row.lat == null || row.lon == null) return row;
  const nws = await nwsObservationStation(row.lat, row.lon);
  row.nwsStationId = nws.id;
  row.nwsStationName = nws.name;
  return row;
}

function applyOverride(d, ov) {
  return emptyRow(d, {
    status: "matched",
    agency: ov.agency,
    siteId: String(ov.siteId),
    siteName: ov.siteName ?? ov.siteId,
    lat: ov.lat ?? null,
    lon: ov.lon ?? null,
    score: 1,
    source: "override",
    note: ov.note || `Pinned in station-overrides.json (${ov.agency} ${ov.siteId}).`,
  });
}

function matchOrAmbiguous(d, sites, agency, missNote, opts = {}) {
  const hits = bestMatches(d.waterbody, opts.skipType ? null : d.waterType, sites, MATCH_FLOOR, {
    skipType: Boolean(opts.skipType),
    relaxType: Boolean(opts.skipType),
  });
  const picked = pickUnique(d.waterbody, hits);
  if (picked) {
    const extra =
      picked.alternateCount > 1
        ? ` ${picked.alternateCount} official stations publish under this name; using ${picked.row.id}. Pin another in station-overrides.json if this is the wrong reach. Other candidates: ${picked.alternates.slice(1).join("; ")}.`
        : "";
    return emptyRow(d, {
      status: "matched",
      agency,
      siteId: picked.row.id,
      siteName: picked.row.name,
      lat: Number.isFinite(picked.row.lat) ? picked.row.lat : null,
      lon: Number.isFinite(picked.row.lon) ? picked.row.lon : null,
      score: Number(picked.score.toFixed(3)),
      source: "name-match",
      note: `Matched on published name (score ${picked.score.toFixed(2)}). Confirm the reach before trusting the number.${extra}`,
    });
  }
  return emptyRow(d, {
    status: "unmatched",
    note: missNote,
  });
}

async function main() {
  const destinations = JSON.parse(readFileSync(DEST_PATH, "utf8"));
  const overridesFile = JSON.parse(readFileSync(OVERRIDE_PATH, "utf8"));
  const overrideById = new Map((overridesFile.records ?? []).map((r) => [r.destinationId, r]));
  for (const d of destinations) {
    if (overrideById.has(d.id)) continue;
    if (d.usgsSiteId) {
      overrideById.set(d.id, {
        agency: "USGS",
        siteId: String(d.usgsSiteId),
        siteName: d.usgsSiteId,
        note: `Pinned from the catalog usgsSiteId (${d.usgsSiteId}).`,
      });
    } else if (d.noaaCoopsStationId) {
      overrideById.set(d.id, {
        agency: "NOAA-COOPS",
        siteId: String(d.noaaCoopsStationId),
        siteName: d.noaaCoopsStationId,
        note: `Pinned from the catalog noaaCoopsStationId (${d.noaaCoopsStationId}).`,
      });
    }
  }

  const byState = new Map();
  for (const d of destinations) {
    if (!byState.has(d.state)) byState.set(d.state, []);
    byState.get(d.state).push(d);
  }

  const records = [];
  const errors = [];

  let noaa = [];
  try {
    noaa = await noaaStations();
    console.error(`index NOAA CO-OPS → ${noaa.length} water-level stations`);
  } catch (err) {
    console.error(`fail  NOAA: ${err.message}`);
  }

  let wsc = [];
  try {
    wsc = await wscStations();
    console.error(`index WSC → ${wsc.length} active stations`);
  } catch (err) {
    console.error(`fail  WSC: ${err.message}`);
  }
  const wscByProv = new Map();
  for (const s of wsc) {
    if (!wscByProv.has(s.prov)) wscByProv.set(s.prov, []);
    wscByProv.get(s.prov).push(s);
  }

  for (const [state, rows] of [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const isProvince = Boolean(PROV_CODE[state]);
    const usgsCode = STATE_CODE[state];

    let usgsSites = [];
    if (usgsCode) {
      try {
        usgsSites = await usgsStateSites(usgsCode);
        console.error(`index USGS ${state} → ${usgsSites.length} sites`);
      } catch (err) {
        console.error(`fail  USGS ${state}: ${err.message}`);
        errors.push({ state, error: String(err.message) });
      }
    }

    let matched = 0;
    for (const d of rows) {
      const ov = overrideById.get(d.id);
      if (ov?.siteId && ov?.agency) {
        records.push(applyOverride(d, ov));
        matched += 1;
        continue;
      }

      if (DENY_AUTO.has(d.id)) {
        records.push(
          emptyRow(d, {
            status: "unmatched",
            note: "Official stations share a common name with this record but publish on a different water or reach. No nearby station is substituted.",
          }),
        );
        continue;
      }

      if (usgsCode && usgsSites.length) {
        const row = matchOrAmbiguous(
          d,
          usgsSites,
          "USGS",
          "No USGS station publishes under this waterbody's name. No nearby station is substituted.",
        );
        if (row.status === "matched") {
          records.push(row);
          matched += 1;
          continue;
        }
      } else if (usgsCode && !usgsSites.length && !isProvince) {
        records.push(
          emptyRow(d, {
            status: "error",
            note: `USGS site index could not be reached for ${state}. Treat as unmonitored until the next resolve run.`,
          }),
        );
        continue;
      }

      const marineCandidate =
        d.waterType === "marine" || MARINE_NAME.test(d.waterbody) || GREAT_LAKES.test(d.waterbody);
      if (marineCandidate && noaa.length) {
        const abbr = STATE_ABBR[state];
        const great = GREAT_LAKES.test(d.waterbody);
        const inState = abbr ? noaa.filter((s) => s.state === abbr) : [];
        const greatSites = great ? noaa.filter((s) => s.greatlakes) : [];
        let row = matchOrAmbiguous(
          d,
          inState,
          "NOAA-COOPS",
          "No NOAA CO-OPS station publishes under this waterbody's name. No nearby tide gauge is substituted.",
          { skipType: true },
        );
        if (row.status !== "matched" && greatSites.length) {
          row = matchOrAmbiguous(
            d,
            greatSites,
            "NOAA-COOPS",
            "No NOAA CO-OPS station publishes under this waterbody's name. No nearby tide gauge is substituted.",
            { skipType: true },
          );
        }
        if (row.status === "matched") {
          records.push(row);
          matched += 1;
          continue;
        }
      }

      if (isProvince) {
        const code = PROV_CODE[state];
        const sites = wscByProv.get(code) ?? [];
        if (!wsc.length) {
          records.push(
            emptyRow(d, {
              status: "unsupported",
              note: "Water Survey of Canada index could not be reached on this run.",
            }),
          );
          continue;
        }
        const row = matchOrAmbiguous(
          d,
          sites,
          "WSC",
          "No Water Survey of Canada station publishes under this waterbody's name. No nearby station is substituted.",
        );
        records.push(row);
        if (row.status === "matched") matched += 1;
        continue;
      }

      records.push(
        emptyRow(d, {
          status: "unmatched",
          note: marineCandidate
            ? "No USGS or NOAA CO-OPS station publishes under this waterbody's name. No nearby station is substituted."
            : "No USGS station publishes under this waterbody's name. No nearby station is substituted.",
        }),
      );
    }
    console.error(`bind  ${state} ${matched}/${rows.length} matched`);
  }

  const unmatchedUs = records.filter((r) => r.status === "unmatched" && STATE_CODE[r.state]);
  console.error(`usgs  name-search ${unmatchedUs.length} unmatched US waters`);
  const destById = new Map(destinations.map((d) => [d.id, d]));
  let named = 0;
  const searchQueue = [...unmatchedUs];
  async function searchWorker() {
    while (searchQueue.length) {
      const row = searchQueue.shift();
      if (!row) return;
      const d = destById.get(row.destinationId);
      if (!d || DENY_AUTO.has(d.id)) continue;
      const sites = await usgsNameSearch(STATE_CODE[row.state], d.waterbody);
      if (!sites.length) continue;
      const hit = matchOrAmbiguous(d, sites, "USGS", row.note);
      if (hit.status === "matched") {
        Object.assign(row, hit);
        named += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, searchWorker));
  console.error(`usgs  name-search recovered ${named}`);

  records.sort((a, b) => a.destinationId.localeCompare(b.destinationId));

  let locations = { records: [] };
  try {
    locations = JSON.parse(readFileSync(LOC_PATH, "utf8"));
  } catch {
    /* locations file optional until the gazetteer pass has run */
  }
  const locById = new Map((locations.records ?? []).map((r) => [r.destinationId, r]));
  for (const row of records) {
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

  const noaaById = new Map(noaa.map((s) => [s.id, s]));
  const wscById = new Map(wsc.map((s) => [s.id, s]));
  for (const row of records) {
    if (row.status !== "matched" || (row.lat != null && row.lon != null)) continue;
    const extra =
      row.agency === "NOAA-COOPS"
        ? noaaById.get(row.siteId)
        : row.agency === "WSC"
          ? wscById.get(row.siteId)
          : null;
    if (extra && Number.isFinite(extra.lat) && Number.isFinite(extra.lon)) {
      row.lat = extra.lat;
      row.lon = extra.lon;
    }
  }

  console.error("nws   binding observation stations to every located water");
  let priorById = new Map();
  try {
    const prior = JSON.parse(readFileSync(OUT_PATH, "utf8"));
    priorById = new Map((prior.records ?? []).map((r) => [r.destinationId, r]));
  } catch {
    /* first resolve */
  }
  const locatedRows = records.filter((r) => r.lat != null && r.lon != null && !PROV_CODE[r.state]);
  const needNws = [];
  for (const row of locatedRows) {
    const prev = priorById.get(row.destinationId);
    if (
      prev?.nwsStationId &&
      prev.lat != null &&
      prev.lon != null &&
      Math.abs(prev.lat - row.lat) < 0.02 &&
      Math.abs(prev.lon - row.lon) < 0.02
    ) {
      row.nwsStationId = prev.nwsStationId;
      row.nwsStationName = prev.nwsStationName ?? prev.nwsStationId;
    } else {
      needNws.push(row);
    }
  }
  console.error(`nws   reuse ${locatedRows.length - needNws.length} · fetch ${needNws.length}`);
  let nwsDone = 0;
  const queue = [...needNws];
  async function nwsWorker() {
    while (queue.length) {
      const row = queue.shift();
      if (!row) return;
      await attachNws(row);
      nwsDone += 1;
      if (nwsDone % 25 === 0) console.error(`nws   ${nwsDone}/${needNws.length}`);
    }
  }
  if (queue.length) await Promise.all(Array.from({ length: 6 }, nwsWorker));

  const matched = records.filter((r) => r.status === "matched");
  const byAgency = {};
  for (const r of matched) {
    if (r.agency) byAgency[r.agency] = (byAgency[r.agency] ?? 0) + 1;
  }

  const payload = {
    schema: "0.6.0",
    generatedAt: new Date().toISOString(),
    matchFloor: MATCH_FLOOR,
    doctrine:
      "Override file wins. Otherwise name + water-type must align. Ambiguous multi-matches stay unmatched. No nearby-station substitution. Gaps stay gaps.",
    stats: {
      records: records.length,
      matched: matched.length,
      unmatched: records.filter((r) => r.status === "unmatched").length,
      unsupported: records.filter((r) => r.status === "unsupported").length,
      error: records.filter((r) => r.status === "error").length,
      overrides: records.filter((r) => r.source === "override").length,
      located: records.filter((r) => r.lat != null && r.lon != null).length,
      nwsBound: records.filter((r) => r.nwsStationId).length,
      byAgency,
    },
    records,
    errors,
  };

  coarsenLocations(records);

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(
    `wrote ${OUT_PATH} · ${payload.stats.matched} matched` +
      ` (USGS ${byAgency.USGS ?? 0} · NOAA ${byAgency["NOAA-COOPS"] ?? 0} · WSC ${byAgency.WSC ?? 0}` +
      ` · USBR ${byAgency.USBR ?? 0} · USACE ${byAgency.USACE ?? 0} · CDEC ${byAgency.CDEC ?? 0})` +
      ` · ${payload.stats.unmatched} unmatched · ${payload.stats.overrides} overrides` +
      ` · ${payload.stats.nwsBound} NWS obs stations`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
