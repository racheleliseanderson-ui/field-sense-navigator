#!/usr/bin/env node
/**
 * Locate every catalog water by its published name and jurisdiction.
 *
 * Gazetteer lookup of the named water — not a nearby-gauge guess — so
 * every record can carry the same live layers (weather, forecast, gauge
 * attempt). Hydro features are preferred. Administrative points are
 * accepted only for marine/pier records when no hydro feature exists.
 *
 * Usage:
 *   node scripts/resolve-locations.mjs              # resume; skip located + missed
 *   node scripts/resolve-locations.mjs --retry-misses
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEST_PATH = resolve(ROOT, "src/data/destinations.json");
const OVERRIDE_PATH = resolve(ROOT, "src/data/location-overrides.json");
const OUT_PATH = resolve(ROOT, "src/data/locations.json");

const UA = "HookTheHorizon-FieldSense/0.6 (rachel.elise.anderson@gmail.com)";
const RETRY_MISSES = process.argv.includes("--retry-misses");

const PROVINCES = new Set([
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
]);

const STATE_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY",
  Alberta: "AB", "British Columbia": "BC", Manitoba: "MB", "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL", "Northwest Territories": "NT",
  "Nova Scotia": "NS", Nunavut: "NU", Ontario: "ON",
  "Prince Edward Island": "PE", Quebec: "QC", Saskatchewan: "SK", Yukon: "YT",
};

const HYDRO_KEY = new Set(["water", "waterway", "natural"]);
const HYDRO_VAL = new Set([
  "lake", "reservoir", "pond", "basin", "river", "stream", "canal", "rapids",
  "bay", "lagoon", "harbour", "harbor", "fjord", "strait", "wetland", "water",
  "oxbow", "dock", "beach", "cape", "reef", "shoal", "flowline",
]);

/** Search names that the gazetteer actually publishes. Never a neighbor water. */
const ALIAS = {
  "Canyon Ferry Reservoir": ["Canyon Ferry Lake"],
  "Hauser Reservoir": ["Hauser Lake"],
  "Eleven Mile Reservoir": ["Elevenmile Canyon Reservoir", "Elevenmile Reservoir"],
  "Quincy Lakes complex": ["Quincy Lake"],
  "Henry's Fork of the Snake River": ["Henrys Fork", "Henry's Fork"],
  "Middle Fork of the Salmon River": ["Middle Fork Salmon River"],
  "Mississippi River Pool 2": ["Lock and Dam 2", "Mississippi River Saint Paul"],
  "Mississippi River Pool 9": ["Lock and Dam 9", "Mississippi River Lynxville"],
  "Mississippi River Pool 13": ["Lock and Dam 13", "Mississippi River Clinton"],
  "South Fork Snake River": ["South Fork Snake River", "South Fork of the Snake River"],
  "Lower Laguna Madre": ["Laguna Madre"],
  "Toledo Bend Reservoir": ["Toledo Bend"],
  "Falcon Reservoir": ["Falcon Lake"],
  "Bridgeport Reservoir and Twin Lakes": ["Bridgeport Reservoir"],
  "Chickamauga Reservoir": ["Chickamauga Lake"],
  "Norris Reservoir": ["Norris Lake"],
  "Milford Reservoir": ["Milford Lake"],
  "Harlan County Reservoir": ["Harlan County Lake"],
  "Flaming Gorge Reservoir": ["Flaming Gorge Reservoir"],
  "Lake Tahoe": ["Lake Tahoe"],
  "Wahiawa Public Fishing Area": ["Wahiawa Reservoir", "Lake Wilson"],
  "Waiakea Public Fishing Area": ["Waiakea Pond"],
  "Ottawa River": ["Ottawa River", "Rivière des Outaouais"],
  "Matapédia River": ["Rivière Matapédia", "Matapedia River"],
  "Lac Témiscamingue": ["Lac Temiscamingue", "Lake Timiskaming"],
  "Réservoir Baskatong": ["Baskatong Reservoir", "Réservoir Baskatong"],
  "Iqaluit area tidal flats": ["Iqaluit", "Frobisher Bay"],
  "Susquehanna Flats": ["Susquehanna Flats"],
  "Wisconsin public navigable waters access network": [],
};

function cleanName(water) {
  return String(water)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[—–].*$/, " ")
    .replace(/\/.*$/, " ")
    .replace(/\b(public access corridor|access corridor|public corridor|complex)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variants(d) {
  const cleaned = cleanName(d.waterbody);
  if (Object.prototype.hasOwnProperty.call(ALIAS, cleaned) && ALIAS[cleaned].length === 0) {
    return [];
  }
  const out = [];
  const push = (s) => {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(cleaned);
  const paren = String(d.waterbody).match(/\(([^)]+)\)/);
  if (paren) {
    const first = paren[1].split(/,| and | — | – /)[0].trim();
    if (first.length > 3 && !/public|corridor|side|reach|network/i.test(first)) push(first);
  }
  for (const [key, names] of Object.entries(ALIAS)) {
    if (cleaned === key || cleaned.startsWith(key) || d.waterbody.startsWith(key)) {
      for (const n of names) push(n);
    }
  }
  if (/Reservoir$/i.test(cleaned)) push(cleaned.replace(/Reservoir$/i, "Lake"));
  if (/Lake$/i.test(cleaned)) push(cleaned.replace(/Lake$/i, "Reservoir"));
  return out;
}

function stateMatches(hitState, wanted) {
  if (!hitState || !wanted) return false;
  const a = String(hitState).toLowerCase();
  const b = wanted.toLowerCase();
  const abbr = (STATE_ABBR[wanted] || "").toLowerCase();
  return a === b || a === abbr || a.includes(b) || b.includes(a);
}

function isHydro(p) {
  return HYDRO_KEY.has(p.osm_key) || HYDRO_VAL.has(p.osm_value);
}

async function photon(q, osmTag) {
  const params = new URLSearchParams({ q, limit: "8" });
  if (osmTag) params.set("osm_tag", osmTag);
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = await res.json();
  return json.features ?? [];
}

async function nominatim(q) {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "6",
    addressdetails: "1",
    extratags: "1",
  });
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.status === 429 || res.status === 503) {
      lastErr = new Error(`Nominatim ${res.status}`);
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const json = await res.json();
    return (json ?? []).map((h) => ({
      geometry: { coordinates: [Number(h.lon), Number(h.lat)] },
      properties: {
        name: h.display_name,
        state: h.address?.state || h.address?.province || h.address?.territory,
        county: h.address?.county,
        country: h.address?.country,
        osm_key: h.category,
        osm_value: h.type,
      },
    }));
  }
  throw lastErr ?? new Error("Nominatim unreachable");
}

function pick(features, state, waterType) {
  const inState = features.filter((f) => stateMatches(f.properties?.state, state));
  const hydro = inState.filter((f) => isHydro(f.properties ?? {}));
  if (hydro.length) return { feat: hydro[0], kind: "hydro" };
  if ((waterType === "marine" || waterType === "lake" || waterType === "reservoir") && inState.length) {
    return { feat: inState[0], kind: "place" };
  }
  // Distinctive named water: accept a hydro hit whose country matches even if
  // Photon omitted the state field (common on Quebec / border reservoirs).
  const hydroAny = features.filter((f) => isHydro(f.properties ?? {}));
  if (hydroAny.length === 1) return { feat: hydroAny[0], kind: "hydro" };
  return null;
}

function rowFrom(d, picked, query, extraNote) {
  const p = picked.feat.properties ?? {};
  const c = picked.feat.geometry?.coordinates ?? [];
  return {
    destinationId: d.id,
    state: d.state,
    waterbody: d.waterbody,
    waterType: d.waterType,
    status: "located",
    kind: picked.kind,
    query,
    lat: Number(c[1]),
    lon: Number(c[0]),
    gazetteerName: [p.name, p.county, p.state, p.country].filter(Boolean).join(", "),
    featureClass: p.osm_key ?? null,
    featureType: p.osm_value ?? null,
    note:
      extraNote ||
      (picked.kind === "hydro"
        ? "Located as a hydro feature under the published name and jurisdiction."
        : "No hydro feature under this name; located to the named place so weather can still be bound."),
  };
}

function miss(d, query, note) {
  return {
    destinationId: d.id,
    state: d.state,
    waterbody: d.waterbody,
    waterType: d.waterType,
    status: "missed",
    kind: null,
    query,
    lat: null,
    lon: null,
    gazetteerName: null,
    featureClass: null,
    featureType: null,
    note,
  };
}

function applyOverride(d, ov) {
  return {
    destinationId: d.id,
    state: d.state,
    waterbody: d.waterbody,
    waterType: d.waterType,
    status: "located",
    kind: ov.kind ?? "override",
    query: ov.query ?? "location-overrides.json",
    lat: ov.lat,
    lon: ov.lon,
    gazetteerName: ov.name ?? d.waterbody,
    featureClass: ov.featureClass ?? "override",
    featureType: ov.featureType ?? null,
    note: ov.note || "Pinned in location-overrides.json to the published water, not a neighbor.",
  };
}

async function locateOne(d) {
  const names = variants(d);
  if (names.length === 0) {
    return miss(
      d,
      d.waterbody,
      "This record is a jurisdiction-wide access network, not a single named water. No point is invented.",
    );
  }
  const country = PROVINCES.has(d.state) ? "Canada" : "USA";
  let lastQuery = names[0];

  for (const name of names) {
    const q = `${name} ${d.state} ${country}`;
    lastQuery = q;
    try {
      const feats = await photon(q);
      const picked = pick(feats, d.state, d.waterType);
      if (picked) return rowFrom(d, picked, q);
      const tagged = await photon(`${name} ${d.state}`, d.waterType === "river" ? "waterway" : "water");
      const pickedTag = pick(tagged, d.state, d.waterType);
      if (pickedTag) return rowFrom(d, pickedTag, q);
    } catch {
      /* Photon is flaky from some networks; Nominatim is the fallback. */
    }
  }

  for (const name of names.slice(0, 3)) {
    const q = `${name}, ${d.state}, ${country}`;
    lastQuery = q;
    try {
      await new Promise((r) => setTimeout(r, 1600));
      const feats = await nominatim(q);
      const picked = pick(feats, d.state, d.waterType);
      if (picked) return rowFrom(d, picked, q);
    } catch (err) {
      return miss(d, lastQuery, `Gazetteer could not be reached (${err.message}).`);
    }
  }
  return miss(
    d,
    lastQuery,
    "No gazetteer feature in this jurisdiction publishes under this waterbody's name.",
  );
}

async function poolMap(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
      if ((idx + 1) % 20 === 0) console.error(`geo   ${idx + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
}

async function main() {
  const destinations = JSON.parse(readFileSync(DEST_PATH, "utf8"));
  const overrides = existsSync(OVERRIDE_PATH)
    ? JSON.parse(readFileSync(OVERRIDE_PATH, "utf8"))
    : { records: [] };
  const overrideById = new Map((overrides.records ?? []).map((r) => [r.destinationId, r]));

  const prior = new Map();
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, "utf8"));
      for (const r of prev.records ?? []) {
        if (r.note === "Pending.") continue;
        if (r.status === "located") prior.set(r.destinationId, r);
        else if (r.status === "missed" && !RETRY_MISSES) prior.set(r.destinationId, r);
      }
    } catch {
      /* start fresh */
    }
  }

  // Overrides always win and are re-applied every run.
  for (const d of destinations) {
    const ov = overrideById.get(d.id);
    if (ov && ov.lat != null && ov.lon != null) {
      prior.set(d.id, applyOverride(d, ov));
    }
  }

  const pending = destinations.filter((d) => !prior.has(d.id));
  console.error(
    `geo   resume ${prior.size} held · ${pending.length} to locate` +
      (RETRY_MISSES ? " (retrying misses)" : ""),
  );

  const fresh = [];
  const flush = () => {
    const byId = new Map([...prior, ...fresh.map((r) => [r.destinationId, r])]);
    const records = destinations.map(
      (d) => byId.get(d.id) ?? miss(d, "", "Pending."),
    );
    const located = records.filter((r) => r.status === "located");
    const payload = {
      schema: "0.6.0",
      generatedAt: new Date().toISOString(),
      doctrine:
        "Gazetteer lookup of the published water name in its jurisdiction. Not a nearby-gauge substitute. Hydro features preferred. location-overrides.json wins.",
      stats: {
        records: records.length,
        located: located.length,
        missed: records.filter((r) => r.status === "missed" && r.note !== "Pending.").length,
        hydro: located.filter((r) => r.kind === "hydro").length,
        place: located.filter((r) => r.kind === "place").length,
        override: located.filter((r) => r.kind === "override").length,
        pending: records.filter((r) => r.note === "Pending.").length,
      },
      records,
    };
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  };

  const results = await poolMap(pending, 3, async (d, idx) => {
    const row = await locateOne(d);
    fresh.push(row);
    if ((idx + 1) % 10 === 0) {
      flush();
      console.error(`geo   ${prior.size + fresh.length}/${destinations.length} · last ${row.status} ${d.waterbody}`);
    }
    return row;
  });
  for (const r of results) prior.set(r.destinationId, r);
  flush();
  const located = [...prior.values()].filter((r) => r.status === "located").length;
  const missed = [...prior.values()].filter((r) => r.status === "missed").length;
  console.error(`wrote ${OUT_PATH} · ${located}/${destinations.length} located · ${missed} missed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
