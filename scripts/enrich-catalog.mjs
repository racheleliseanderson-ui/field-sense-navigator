#!/usr/bin/env node
/**
 * Catalog enrichment: managingAgency / officialRegsUrl from cited domains,
 * plus explicit related[] links.
 *
 * Rules:
 * - Accuracy outranks completeness. Unmatched / tourism CVB domains stay null.
 * - Only fill agency/regs when currently empty.
 * - related[] is additive; never merges records.
 * - same_waterbody_segment is editorial (homonyms excluded).
 * - shared_agency_page is exact officialSourceUrl match (including statewide
 *   directory pages — those are shared pages, not the same waterbody).
 *
 * Usage: node scripts/enrich-catalog.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "../src/data/destinations.json");

/** @type {Record<string, [string, string | null]>} */
const DOMAIN_AGENCY = {
  "tpwd.texas.gov": ["Texas Parks and Wildlife Department", "https://tpwd.texas.gov/regulations/outdoor-annual/"],
  "wdfw.wa.gov": ["Washington Department of Fish and Wildlife", "https://www.wdfw.wa.gov/fishing/regulations"],
  "myfwp.mt.gov": ["Montana Fish, Wildlife & Parks", "https://fwp.mt.gov/fish"],
  "fwp.mt.gov": ["Montana Fish, Wildlife & Parks", "https://fwp.mt.gov/fish"],
  "dnr.state.mn.us": ["Minnesota Department of Natural Resources", "https://www.dnr.state.mn.us/regulations/fishing/index.html"],
  "fs.usda.gov": ["USDA Forest Service", null],
  "cpw.state.co.us": ["Colorado Parks and Wildlife", "https://cpw.state.co.us/thingstodo/Pages/Fishing.aspx"],
  "idfg.idaho.gov": ["Idaho Department of Fish and Game", "https://idfg.idaho.gov/rules"],
  "floridastateparks.org": ["Florida State Parks", null],
  "myfwc.com": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "gis.myfwc.com": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "ocean.floridamarine.org": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "michigan.gov": ["Michigan Department of Natural Resources", "https://www.michigan.gov/dnr/things-to-do/fishing"],
  "wildlife.ca.gov": ["California Department of Fish and Wildlife", "https://wildlife.ca.gov/Fishing"],
  "ontario.ca": ["Ontario Ministry of Natural Resources and Forestry", "https://www.ontario.ca/page/fishing"],
  "nps.gov": ["National Park Service", null],
  "www2.gov.bc.ca": ["British Columbia Ministry of Water, Land and Resource Stewardship", null],
  "mffp.gouv.qc.ca": ["Ministère des Forêts, de la Faune et des Parcs (Québec)", null],
  "dnr.wisconsin.gov": ["Wisconsin Department of Natural Resources", "https://dnr.wisconsin.gov/topic/Fishing"],
  "dec.ny.gov": ["New York State Department of Environmental Conservation", "https://www.dec.ny.gov/outdoor/fishing.html"],
  "albertaregulations.ca": ["Alberta Environment and Parks", null],
  "maine.gov": ["Maine Department of Inland Fisheries and Wildlife", null],
  "mass.gov": ["Massachusetts Division of Fisheries and Wildlife", null],
  "wlf.louisiana.gov": ["Louisiana Department of Wildlife and Fisheries", null],
  "ohiodnr.gov": ["Ohio Department of Natural Resources", null],
  "parksandrecreation.idaho.gov": ["Idaho Department of Parks and Recreation", null],
  "dep.nj.gov": ["New Jersey Department of Environmental Protection", "https://dep.nj.gov/njfw/"],
  "dnr.sc.gov": ["South Carolina Department of Natural Resources", null],
  "outdooralabama.com": ["Alabama Department of Conservation and Natural Resources", null],
  "dwr.virginia.gov": ["Virginia Department of Wildlife Resources", null],
  "dnr.maryland.gov": ["Maryland Department of Natural Resources", null],
  "adfg.alaska.gov": ["Alaska Department of Fish and Game", null],
  "gov.mb.ca": ["Manitoba Natural Resources and Northern Development", null],
  "myodfw.com": ["Oregon Department of Fish and Wildlife", "https://myodfw.com/fishing"],
  "fishandboat.com": ["Pennsylvania Fish and Boat Commission", null],
  "dnr.illinois.gov": ["Illinois Department of Natural Resources", null],
  "parks.ca.gov": ["California State Parks", null],
  "wildlife.nh.gov": ["New Hampshire Fish and Game Department", null],
  "portal.ct.gov": ["Connecticut Department of Energy and Environmental Protection", null],
  "georgiawildlife.com": ["Georgia Department of Natural Resources", null],
  "ncwildlife.gov": ["North Carolina Wildlife Resources Commission", null],
  "tn.gov": ["Tennessee Wildlife Resources Agency", null],

  "fw.ky.gov": ["Kentucky Department of Fish and Wildlife Resources", "https://fw.ky.gov/Fish/Pages/default.aspx"],
  "mdwfp.com": ["Mississippi Department of Wildlife, Fisheries, and Parks", "https://www.mdwfp.com/fishing-boating/"],
  "agfc.com": ["Arkansas Game and Fish Commission", "https://www.agfc.com/fishing/"],
  "mdc.mo.gov": ["Missouri Department of Conservation", "https://mdc.mo.gov/fishing"],
  "wildlifedepartment.com": ["Oklahoma Department of Wildlife Conservation", "https://www.wildlifedepartment.com/fishing"],
  "ksoutdoors.com": ["Kansas Department of Wildlife and Parks", "https://ksoutdoors.com/Fishing"],
  "outdoornebraska.gov": ["Nebraska Game and Parks Commission", "https://outdoornebraska.gov/fishing/"],
  "iowadnr.gov": ["Iowa Department of Natural Resources", "https://www.iowadnr.gov/Fishing"],
  "gfp.sd.gov": ["South Dakota Game, Fish and Parks", "https://gfp.sd.gov/fishing/"],
  "gf.nd.gov": ["North Dakota Game and Fish Department", "https://gf.nd.gov/fishing"],
  "wgfd.wyo.gov": ["Wyoming Game and Fish Department", "https://wgfd.wyo.gov/fishing-boating"],
  "wildlife.utah.gov": ["Utah Division of Wildlife Resources", null],
  "ndow.org": ["Nevada Department of Wildlife", "https://www.ndow.org/fish/"],
  "wildlife.state.nm.us": ["New Mexico Department of Game and Fish", "https://www.wildlife.state.nm.us/fishing/"],
  "azgfd.com": ["Arizona Game and Fish Department", "https://www.azgfd.com/fishing/"],
  "wvdnr.gov": ["West Virginia Division of Natural Resources", "https://wvdnr.gov/fishing/"],
  "in.gov": ["Indiana Department of Natural Resources", "https://www.in.gov/dnr/fish-and-wildlife/fishing/"],
  "vtfishandwildlife.com": ["Vermont Fish & Wildlife Department", "https://vtfishandwildlife.com/fish"],
  "dnrec.delaware.gov": ["Delaware Department of Natural Resources and Environmental Control", "https://dnrec.delaware.gov/fish-wildlife/fishing/"],
  "dlnr.hawaii.gov": ["Hawaiʻi Department of Land and Natural Resources — Division of Aquatic Resources", "https://dlnr.hawaii.gov/dar/fishing/"],
  "dem.ri.gov": ["Rhode Island Department of Environmental Management", "https://dem.ri.gov/natural-resources-bureau/fish-wildlife/freshwater-fisheries"],

  "www2.gnb.ca": ["New Brunswick Department of Natural Resources and Energy Development", null],
  "novascotia.ca": ["Nova Scotia Department of Fisheries and Aquaculture", "https://novascotia.ca/fish/sportfishing/"],
  "princeedwardisland.ca": ["Prince Edward Island Department of Environment, Energy and Climate Action", null],
  "gov.nl.ca": ["Newfoundland and Labrador Department of Fisheries, Forestry and Agriculture", "https://www.gov.nl.ca/ffa/licences/recreational-fishing/"],
  "yukon.ca": ["Yukon Department of Environment", "https://yukon.ca/en/fishing-licences-and-regulations"],
  "gov.nu.ca": ["Government of Nunavut — Department of Environment", "https://www.gov.nu.ca/en/environment/sport-fishing"],
  "saskatchewan.ca": ["Saskatchewan Ministry of Environment", "https://www.saskatchewan.ca/residents/parks-culture-heritage-and-sport/hunting-trapping-and-angling/angling"],
  "envrbrportal.crm.saskatchewan.ca": ["Saskatchewan Ministry of Environment", "https://envrbrportal.crm.saskatchewan.ca/fishing-guide/"],
  "enr.gov.nt.ca": ["Northwest Territories Environment and Climate Change", "https://www.enr.gov.nt.ca/en/services/sport-fishing"],
  "gov.nt.ca": ["Northwest Territories Environment and Climate Change", "https://www.gov.nt.ca/ecc/en/services/sport-fishing"],
  "pac.dfo-mpo.gc.ca": ["Fisheries and Oceans Canada — Pacific Region", "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html"],

  "usbr.gov": ["U.S. Bureau of Reclamation", null],
  "blm.gov": ["U.S. Bureau of Land Management", null],
  "fws.gov": ["U.S. Fish and Wildlife Service", null],
  "corpslakes.erdc.dren.mil": ["U.S. Army Corps of Engineers", null],

  "larimer.gov": ["Larimer County Natural Resources", null],
  "monocounty.org": ["Mono County, California", null],
  "parks.ny.gov": ["New York State Office of Parks, Recreation and Historic Preservation", null],
  "auroragov.org": ["City of Aurora, Colorado", null],
  "bouldercolorado.gov": ["City of Boulder Parks and Recreation", null],
  "parks.wa.gov": ["Washington State Parks", null],
  "pinellascounty.org": ["Pinellas County Parks and Conservation Resources", null],
  "jacksonville.gov": ["City of Jacksonville Parks and Recreation", null],
  "crystalriverfl.org": ["City of Crystal River, Florida", null],
  "miamidade.gov": ["Miami-Dade County Parks, Recreation and Open Spaces", null],
  "water.ca.gov": ["California Department of Water Resources", null],
  "sandiego.gov": ["City of San Diego Parks and Recreation", null],
  "bbmwd.com": ["Big Bear Municipal Water District", null],
  "mwdh2o.com": ["Metropolitan Water District of Southern California", null],
  "rivcoparks.org": ["Riverside County Regional Park and Open-Space District", null],
  "countyofsb.org": ["County of Santa Barbara Parks", null],
  "castaiclake.com": ["Los Angeles County Department of Parks and Recreation", null],
};

/**
 * Tourism / commercial publisher domains. The cited URL is kept as
 * officialSourceUrl; we do not invent a managing agency from a CVB.
 */
const SKIP_DOMAINS = new Set([
  "destinfwb.com",
  "portaransas.org",
  "portisabelsouthpadre.com",
  "visitcorpuschristi.com",
  "navarrebeachpier.com",
]);

/**
 * Editorial same-waterbody groups. Homonyms excluded:
 * Clear Lake (WA / CA / IA), Pyramid Lake (CA DWR vs NV), Rainy Lake WA
 * (North Cascades) vs Rainy Lake MN/ON.
 */
const SAME_WATERBODY = [
  ["HHI-DEST-016", "HHI-DEST-017", "HHI-DEST-018", "HHI-DEST-030", "HHI-DEST-285", "HHI-DEST-290"],
  ["HHI-DEST-013", "HHI-DEST-015", "HHI-DEST-280", "HHI-DEST-296", "HHI-DEST-300"],
  ["HHI-DEST-024", "HHI-DEST-032", "HHI-DEST-284"],
  ["HHI-DEST-006", "HHI-DEST-098"],
  ["HHI-DEST-011", "HHI-DEST-473"],
  ["HHI-DEST-019", "HHI-DEST-020"],
  ["HHI-DEST-023", "HHI-DEST-095"],
  ["HHI-DEST-036", "HHI-DEST-083"],
  ["HHI-DEST-043", "HHI-DEST-081"],
  ["HHI-DEST-044", "HHI-DEST-082"],
  ["HHI-DEST-079", "HHI-DEST-439"],
  ["HHI-DEST-134", "HHI-DEST-173"],
  ["HHI-DEST-181", "HHI-DEST-347"],
  ["HHI-DEST-225", "HHI-DEST-228"],
  ["HHI-DEST-249", "HHI-DEST-392"],
  ["HHI-DEST-309", "HHI-DEST-496"],
  ["HHI-DEST-317", "HHI-DEST-417"],
  ["HHI-DEST-318", "HHI-DEST-495"],
  ["HHI-DEST-375", "HHI-DEST-381"],
  ["HHI-DEST-383", "HHI-DEST-388"],
  ["HHI-DEST-094", "HHI-DEST-475"],
];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function canonUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}${u.search}`.toLowerCase();
  } catch {
    return (url || "").split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}

function addRelated(record, id, relation) {
  if (!id || id === record.id) return;
  if (!Array.isArray(record.related)) record.related = [];
  const existing = record.related.find((r) => r.id === id);
  if (existing) {
    if (existing.relation === "shared_agency_page" && relation === "same_waterbody_segment") {
      existing.relation = relation;
    }
    return;
  }
  record.related.push({ id, relation });
}

const data = JSON.parse(readFileSync(DATA, "utf8"));
const byId = new Map(data.map((r) => [r.id, r]));

let already = 0;
let enriched = 0;
let skippedTourism = 0;
let noMatch = 0;
const unmatchedHosts = {};

for (const r of data) {
  if (r.managingAgency) {
    already += 1;
    continue;
  }
  const host = hostOf(r.officialSourceUrl || "");
  if (SKIP_DOMAINS.has(host)) {
    skippedTourism += 1;
    continue;
  }
  const hit = DOMAIN_AGENCY[host];
  if (!hit) {
    noMatch += 1;
    unmatchedHosts[host] = (unmatchedHosts[host] || 0) + 1;
    continue;
  }
  const [agency, regs] = hit;
  r.managingAgency = agency;
  if (regs && !r.officialRegsUrl) r.officialRegsUrl = regs;
  if (r.lastVerified) {
    if (!r.regsReviewedDate) r.regsReviewedDate = r.lastVerified;
    if (!r.accessReviewedDate) r.accessReviewedDate = r.lastVerified;
  }
  enriched += 1;
}

let samePairs = 0;
for (const group of SAME_WATERBODY) {
  const present = group.filter((id) => byId.has(id));
  for (const a of present) {
    for (const b of present) {
      if (a === b) continue;
      addRelated(byId.get(a), b, "same_waterbody_segment");
      samePairs += 1;
    }
  }
}

const byUrl = new Map();
for (const r of data) {
  const key = canonUrl(r.officialSourceUrl || "");
  if (!key) continue;
  if (!byUrl.has(key)) byUrl.set(key, []);
  byUrl.get(key).push(r.id);
}

let urlGroups = 0;
let sharedPairs = 0;
for (const ids of byUrl.values()) {
  if (ids.length < 2) continue;
  urlGroups += 1;
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      addRelated(byId.get(a), b, "shared_agency_page");
      sharedPairs += 1;
    }
  }
}

let withRelated = 0;
let relatedLinks = 0;
for (const r of data) {
  if (r.related?.length) {
    withRelated += 1;
    relatedLinks += r.related.length;
    r.related.sort((a, b) => a.id.localeCompare(b.id));
  }
}

writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      alreadyHadAgency: already,
      newlyEnriched: enriched,
      skippedTourismCvb: skippedTourism,
      noDomainMatch: noMatch,
      unmatchedHosts,
      total: data.length,
      withAgencyAfter: already + enriched,
      sameWaterbodyGroups: SAME_WATERBODY.length,
      sharedUrlGroups: urlGroups,
      recordsWithRelated: withRelated,
      relatedLinkCount: relatedLinks,
    },
    null,
    2,
  ),
);
