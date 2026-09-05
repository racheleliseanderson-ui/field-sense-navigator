#!/usr/bin/env node
/**
 * Second-pass USGS site-name search for unmatched US waters.
 * Does not invent neighbors — same matcher as resolve-stations.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bestMatches, pickUnique, searchQueries } from "./match.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEST_PATH = resolve(ROOT, "src/data/destinations.json");
const BIND_PATH = resolve(ROOT, "src/data/station-bindings.json");
const OVERRIDE_PATH = resolve(ROOT, "src/data/station-overrides.json");
// Agencies use this to reach whoever is generating the traffic. A private
// address does not belong in a public repository or in a header sent to five
// federal and provincial agencies on every run.
const CONTACT =
  process.env.AGENCY_CONTACT_URL || "https://northernlanternhouse.com/customer-support";
const UA = `HookTheHorizon-FieldSense/0.6 (+https://waterways.hookthehorizon.blog; contact ${CONTACT})`;
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

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function parseRdb(text) {
  const byId = new Map();
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
  return [...byId.values()];
}

const BAD_SITE =
  /remote sensing|boat launch|boat ramp|rain gage|rain gauge|\bstudy\b|icw |pumping station|lakecliff|site \d|water works|mobile home|well field|computed inflow|visitor cntr|marsh west|\btrib(?:utary)?\b|^(?:it |misc )/i;

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
        for (const site of parseRdb(await fetchText(url))) byId.set(site.id, site);
        break;
      } catch {
        /* next url */
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  return [...byId.values()];
}

const SEARCH_SKIP = new Set([
  "HHI-DEST-202", // Guadalupe State Park is not a random Guadalupe mainstem gauge
  "HHI-DEST-251", // Sacramento R at Delta CA is the town of Delta, not the Delta
]);

async function main() {
  const destinations = JSON.parse(readFileSync(DEST_PATH, "utf8"));
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const bindings = JSON.parse(readFileSync(BIND_PATH, "utf8"));
  const overrides = JSON.parse(readFileSync(OVERRIDE_PATH, "utf8"));
  const overrideById = new Map((overrides.records ?? []).map((r) => [r.destinationId, r]));

  let pinned = 0;
  for (const row of bindings.records) {
    const ov = overrideById.get(row.destinationId);
    if (!ov?.siteId || !ov?.agency) continue;
    if (row.status === "matched" && row.source === "override" && row.siteId === String(ov.siteId)) {
      continue;
    }
    row.status = "matched";
    row.agency = ov.agency;
    row.siteId = String(ov.siteId);
    row.siteName = ov.siteName ?? String(ov.siteId);
    if (ov.lat != null) row.lat = ov.lat;
    if (ov.lon != null) row.lon = ov.lon;
    row.score = 1;
    row.source = "override";
    row.note = ov.note || `Pinned in station-overrides.json (${ov.agency} ${ov.siteId}).`;
    pinned += 1;
  }
  if (pinned) console.error(`pin   applied ${pinned} overrides`);

  const need = bindings.records.filter((r) => r.status === "unmatched" && STATE_CODE[r.state]);
  console.error(`usgs  name-search ${need.length}`);
  let recovered = 0;
  const queue = [...need];
  async function worker() {
    while (queue.length) {
      const row = queue.shift();
      if (!row) return;
      const d = destById.get(row.destinationId);
      if (!d || SEARCH_SKIP.has(d.id)) continue;
      const sites = await usgsNameSearch(STATE_CODE[row.state], d.waterbody);
      if (!sites.length) continue;
      const hits = bestMatches(d.waterbody, d.waterType, sites, MATCH_FLOOR).filter(
        (h) => !BAD_SITE.test(h.row.name),
      );
      const picked = pickUnique(d.waterbody, hits);
      if (!picked) continue;
      const extra =
        picked.alternateCount > 1
          ? ` ${picked.alternateCount} official stations publish under this name; using ${picked.row.id}.`
          : "";
      row.status = "matched";
      row.agency = "USGS";
      row.siteId = picked.row.id;
      row.siteName = picked.row.name;
      if (Number.isFinite(picked.row.lat)) row.lat = picked.row.lat;
      if (Number.isFinite(picked.row.lon)) row.lon = picked.row.lon;
      row.score = Number(picked.score.toFixed(3));
      row.source = "name-match";
      row.note = `Matched on published name via USGS site search (score ${picked.score.toFixed(2)}).${extra}`;
      recovered += 1;
      console.error(
        `hit   ${d.id} ${d.waterbody.slice(0, 40)} → ${picked.row.id} ${picked.row.name}`,
      );
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const matched = bindings.records.filter((r) => r.status === "matched");
  const byAgency = {};
  for (const r of matched) {
    if (r.agency) byAgency[r.agency] = (byAgency[r.agency] ?? 0) + 1;
  }
  bindings.stats = {
    ...bindings.stats,
    records: bindings.records.length,
    matched: matched.length,
    unmatched: bindings.records.filter((r) => r.status === "unmatched").length,
    overrides: bindings.records.filter((r) => r.source === "override").length,
    located: bindings.records.filter((r) => r.lat != null && r.lon != null).length,
    nwsBound: bindings.records.filter((r) => r.nwsStationId).length,
    byAgency,
  };
  bindings.generatedAt = new Date().toISOString();
  writeFileSync(BIND_PATH, `${JSON.stringify(bindings, null, 2)}\n`);
  console.error(
    `wrote ${BIND_PATH} · recovered ${recovered} · ${bindings.stats.matched} matched · ${bindings.stats.unmatched} unmatched`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
