#!/usr/bin/env node
/**
 * Nightly / on-demand station resolver.
 *
 * Walks destinations.json, asks the USGS site index whether a gauge
 * publishes under the water's own name, and writes a fail-closed
 * binding file. No nearby station is substituted. Canadian records
 * are marked unsupported until a Water Survey of Canada pass exists.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEST_PATH = resolve(ROOT, "src/data/destinations.json");
const OUT_PATH = resolve(ROOT, "src/data/station-bindings.json");

const UA = "HookTheHorizon-FieldSense/0.5 (rachel.elise.anderson@gmail.com)";

const STATE_CODE = {
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

const PROVINCES = new Set([
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
]);

const STOP = new Set([
  "the", "of", "north", "south", "east", "west", "upper", "lower",
  "waters", "state", "park", "public", "fas", "segments", "segment",
  "near", "at", "and", "corridor", "approaches", "published",
]);

const MATCH_FLOOR = 0.75;

const TYPE_HINT = {
  lake: /\blake\b|\blk\b|\bpond\b|\breservoir\b/,
  reservoir: /\breservoir\b|\blake\b|\bres\b/,
  river: /\briver\b|\bcreek\b|\bfork\b|\bstream\b|\bcanal\b|\bslough\b/,
  marine: /\bbay\b|\binlet\b|\bsound\b|\bharbor\b|\bharbour\b|\bgulf\b|\bocean\b|\btide\b|\blagoon\b/,
};

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function tokens(water) {
  return norm(water)
    .split(" ")
    .filter((x) => x.length > 2 && !STOP.has(x));
}

function nameScore(water, station) {
  const w = tokens(water);
  if (w.length === 0) return 0;
  const s = norm(station);
  let hit = 0;
  for (const term of w) {
    if (new RegExp(`\\b${term}\\b`).test(s)) hit += 1;
  }
  return hit / w.length;
}

function typeAligned(waterType, stationName) {
  const hint = TYPE_HINT[waterType];
  if (!hint) return true;
  return hint.test(norm(stationName));
}

async function stateSites(code) {
  const url =
    `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${code}` +
    `&parameterCd=00060,00065,00010,62614&siteStatus=active&siteType=ST,LK,ES`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`USGS site index ${code} → ${res.status}`);
  }
  const text = await res.text();
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 7 || cols[0] !== "USGS") continue;
    if (!cols[1] || !cols[2]) continue;
    rows.push({
      id: cols[1],
      name: cols[2],
      lat: Number(cols[4]),
      lon: Number(cols[5]),
    });
  }
  return rows;
}

function bestMatch(waterbody, waterType, sites) {
  let best = null;
  for (const row of sites) {
    if (!typeAligned(waterType, row.name)) continue;
    const score = nameScore(waterbody, row.name);
    if (score >= MATCH_FLOOR && (!best || score > best.score)) {
      best = { row, score };
    }
  }
  return best;
}

async function main() {
  const destinations = JSON.parse(readFileSync(DEST_PATH, "utf8"));
  const byState = new Map();
  for (const d of destinations) {
    if (!byState.has(d.state)) byState.set(d.state, []);
    byState.get(d.state).push(d);
  }

  const records = [];
  const errors = [];

  for (const [state, rows] of [...byState.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (PROVINCES.has(state) || !STATE_CODE[state]) {
      for (const d of rows) {
        records.push({
          destinationId: d.id,
          state,
          waterbody: d.waterbody,
          waterType: d.waterType,
          status: "unsupported",
          siteId: null,
          siteName: null,
          agency: null,
          lat: null,
          lon: null,
          score: 0,
          note: PROVINCES.has(state)
            ? "No USGS station index for this province. Water Survey of Canada binding is not seeded yet."
            : "No official station index is available for this jurisdiction.",
        });
      }
      console.error(`skip  ${state} (${rows.length} unsupported)`);
      continue;
    }

    let sites = [];
    try {
      sites = await stateSites(STATE_CODE[state]);
      console.error(`index ${state} → ${sites.length} sites`);
    } catch (err) {
      console.error(`fail  ${state}: ${err.message}`);
      for (const d of rows) {
        records.push({
          destinationId: d.id,
          state,
          waterbody: d.waterbody,
          waterType: d.waterType,
          status: "error",
          siteId: null,
          siteName: null,
          agency: null,
          lat: null,
          lon: null,
          score: 0,
          note: `USGS site index could not be reached for ${state}. Treat as unmonitored until the next resolve run.`,
        });
        errors.push({ state, id: d.id, error: String(err.message) });
      }
      continue;
    }

    let matched = 0;
    for (const d of rows) {
      const hit = bestMatch(d.waterbody, d.waterType, sites);
      if (!hit) {
        records.push({
          destinationId: d.id,
          state,
          waterbody: d.waterbody,
          waterType: d.waterType,
          status: "unmatched",
          siteId: null,
          siteName: null,
          agency: null,
          lat: null,
          lon: null,
          score: 0,
          note: "No USGS station publishes under this waterbody's name. No nearby station is substituted.",
        });
        continue;
      }
      matched += 1;
      records.push({
        destinationId: d.id,
        state,
        waterbody: d.waterbody,
        waterType: d.waterType,
        status: "matched",
        siteId: hit.row.id,
        siteName: hit.row.name,
        agency: "USGS",
        lat: Number.isFinite(hit.row.lat) ? hit.row.lat : null,
        lon: Number.isFinite(hit.row.lon) ? hit.row.lon : null,
        score: Number(hit.score.toFixed(3)),
        note: `Matched on published name (score ${hit.score.toFixed(2)}). Confirm the reach before trusting the number.`,
      });
    }
    console.error(`bind  ${state} ${matched}/${rows.length} matched`);
  }

  records.sort((a, b) => a.destinationId.localeCompare(b.destinationId));

  const matched = records.filter((r) => r.status === "matched").length;
  const unmatched = records.filter((r) => r.status === "unmatched").length;
  const unsupported = records.filter((r) => r.status === "unsupported").length;
  const failed = records.filter((r) => r.status === "error").length;

  const payload = {
    schema: "0.5.0",
    generatedAt: new Date().toISOString(),
    matchFloor: MATCH_FLOOR,
    doctrine:
      "Name match only. Water-type must align. No nearby-station substitution. Gaps stay gaps.",
    stats: {
      records: records.length,
      matched,
      unmatched,
      unsupported,
      error: failed,
    },
    records,
    errors,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(
    `wrote ${OUT_PATH} · ${matched} matched · ${unmatched} unmatched · ${unsupported} unsupported · ${failed} error`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
