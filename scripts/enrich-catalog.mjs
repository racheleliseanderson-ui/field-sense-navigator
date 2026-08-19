#!/usr/bin/env node
/**
 * Catalog enrichment: managingAgency / officialRegsUrl from cited domains,
 * plus explicit related[] links.
 *
 * Rules:
 * - Accuracy outranks completeness. Tourism CVB hosts are not mapped.
 *   Five corridor records get an editorial government identity (see
 *   EDITORIAL_AGENCY) without changing officialSourceUrl.
 * - Agency-specific hosts map at hostname. Statewide portals (in.gov, tn.gov,
 *   michigan.gov, …) map only when the URL path is a known department prefix.
 * - Only fill agency/regs when currently empty, except path-mapped portal
 *   hosts: those are re-evaluated so a later generic-host fill can be undone
 *   if the path no longer matches.
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

/**
 * Hostname IS the agency. Exact host match, no path required.
 * @type {Record<string, [string, string | null]>}
 */
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
  "wildlife.ca.gov": ["California Department of Fish and Wildlife", "https://wildlife.ca.gov/Fishing"],
  "nps.gov": ["National Park Service", null],
  "mffp.gouv.qc.ca": ["Ministère des Forêts, de la Faune et des Parcs (Québec)", null],
  "dnr.wisconsin.gov": ["Wisconsin Department of Natural Resources", "https://dnr.wisconsin.gov/topic/Fishing"],
  "dec.ny.gov": ["New York State Department of Environmental Conservation", "https://www.dec.ny.gov/outdoor/fishing.html"],
  "albertaregulations.ca": ["Alberta Environment and Parks", null],
  "wlf.louisiana.gov": ["Louisiana Department of Wildlife and Fisheries", null],
  "ohiodnr.gov": ["Ohio Department of Natural Resources", null],
  "parksandrecreation.idaho.gov": ["Idaho Department of Parks and Recreation", null],
  "dep.nj.gov": ["New Jersey Department of Environmental Protection", "https://dep.nj.gov/njfw/"],
  "dnr.sc.gov": ["South Carolina Department of Natural Resources", null],
  "outdooralabama.com": ["Alabama Department of Conservation and Natural Resources", null],
  "dwr.virginia.gov": ["Virginia Department of Wildlife Resources", null],
  "dnr.maryland.gov": ["Maryland Department of Natural Resources", null],
  "adfg.alaska.gov": ["Alaska Department of Fish and Game", null],
  "myodfw.com": ["Oregon Department of Fish and Wildlife", "https://myodfw.com/fishing"],
  "fishandboat.com": ["Pennsylvania Fish and Boat Commission", null],
  "dnr.illinois.gov": ["Illinois Department of Natural Resources", null],
  "parks.ca.gov": ["California State Parks", null],
  "wildlife.nh.gov": ["New Hampshire Fish and Game Department", null],
  "georgiawildlife.com": ["Georgia Department of Natural Resources", null],
  "ncwildlife.gov": ["North Carolina Wildlife Resources Commission", null],

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
  "vtfishandwildlife.com": ["Vermont Fish & Wildlife Department", "https://vtfishandwildlife.com/fish"],
  "dnrec.delaware.gov": ["Delaware Department of Natural Resources and Environmental Control", "https://dnrec.delaware.gov/fish-wildlife/fishing/"],
  "dlnr.hawaii.gov": ["Hawaiʻi Department of Land and Natural Resources — Division of Aquatic Resources", "https://dlnr.hawaii.gov/dar/fishing/"],
  "dem.ri.gov": ["Rhode Island Department of Environmental Management", "https://dem.ri.gov/natural-resources-bureau/fish-wildlife/freshwater-fisheries"],

  "envrbrportal.crm.saskatchewan.ca": ["Saskatchewan Ministry of Environment", "https://envrbrportal.crm.saskatchewan.ca/fishing-guide/"],
  "enr.gov.nt.ca": ["Northwest Territories Environment and Climate Change", "https://www.enr.gov.nt.ca/en/services/sport-fishing"],
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
 * Statewide / whole-of-government portals. The hostname is not an agency.
 * A fill is earned only when the path starts with a known department prefix
 * (case-insensitive). First matching prefix wins.
 *
 * @type {Record<string, Array<{ prefix: string, agency: string, regs: string | null }>>}
 */
const PATH_AGENCY = {
  "in.gov": [
    {
      prefix: "/dnr/",
      agency: "Indiana Department of Natural Resources",
      regs: "https://www.in.gov/dnr/fish-and-wildlife/fishing/",
    },
  ],
  "tn.gov": [
    {
      prefix: "/twra/",
      agency: "Tennessee Wildlife Resources Agency",
      regs: "https://www.tn.gov/twra/fishing.html",
    },
  ],
  "michigan.gov": [
    {
      prefix: "/dnr/",
      agency: "Michigan Department of Natural Resources",
      regs: "https://www.michigan.gov/dnr/things-to-do/fishing",
    },
  ],
  "maine.gov": [
    {
      prefix: "/ifw/",
      agency: "Maine Department of Inland Fisheries and Wildlife",
      regs: null,
    },
  ],
  "mass.gov": [
    {
      prefix: "/info-details/recreational-saltwater-fishing",
      agency: "Massachusetts Division of Marine Fisheries",
      regs: "https://www.mass.gov/info-details/recreational-saltwater-fishing-regulations",
    },
    {
      prefix: "/guides/recreational-saltwater-fishing",
      agency: "Massachusetts Division of Marine Fisheries",
      regs: "https://www.mass.gov/guides/recreational-saltwater-fishing",
    },
    {
      prefix: "/freshwater-fishing",
      agency: "Massachusetts Division of Fisheries and Wildlife",
      regs: "https://www.mass.gov/freshwater-fishing",
    },
  ],
  "portal.ct.gov": [
    {
      prefix: "/deep/",
      agency: "Connecticut Department of Energy and Environmental Protection",
      regs: null,
    },
  ],
  "ontario.ca": [
    {
      prefix: "/document/ontario-fishing-regulations-summary",
      agency: "Ontario Ministry of Natural Resources and Forestry",
      regs: "https://www.ontario.ca/page/fishing",
    },
    {
      prefix: "/page/fishing",
      agency: "Ontario Ministry of Natural Resources and Forestry",
      regs: "https://www.ontario.ca/page/fishing",
    },
  ],
  "gov.mb.ca": [
    {
      prefix: "/nrnd/fish-wildlife/fish/",
      agency: "Manitoba Natural Resources and Northern Development",
      regs: null,
    },
  ],
  "gov.nl.ca": [
    {
      prefix: "/ffa/",
      agency: "Newfoundland and Labrador Department of Fisheries, Forestry and Agriculture",
      regs: "https://www.gov.nl.ca/ffa/licences/recreational-fishing/",
    },
  ],
  "yukon.ca": [
    {
      prefix: "/en/fishing-licences-and-regulations",
      agency: "Yukon Department of Environment",
      regs: "https://yukon.ca/en/fishing-licences-and-regulations",
    },
    {
      prefix: "/en/fishing-regulations-summary",
      agency: "Yukon Department of Environment",
      regs: "https://yukon.ca/en/fishing-regulations-summary",
    },
  ],
  "gov.nu.ca": [
    {
      prefix: "/en/environment/",
      agency: "Government of Nunavut — Department of Environment",
      regs: "https://www.gov.nu.ca/en/environment/sport-fishing",
    },
  ],
  "gov.nt.ca": [
    {
      prefix: "/ecc/",
      agency: "Northwest Territories Environment and Climate Change",
      regs: "https://www.gov.nt.ca/ecc/en/services/sport-fishing",
    },
  ],
  "saskatchewan.ca": [
    {
      prefix: "/residents/parks-culture-heritage-and-sport/hunting-trapping-and-angling/",
      agency: "Saskatchewan Ministry of Environment",
      regs: "https://www.saskatchewan.ca/residents/parks-culture-heritage-and-sport/hunting-trapping-and-angling/angling",
    },
  ],
  "novascotia.ca": [
    {
      prefix: "/fish/sportfishing",
      agency: "Nova Scotia Department of Fisheries and Aquaculture",
      regs: "https://novascotia.ca/fish/sportfishing/",
    },
  ],
  "princeedwardisland.ca": [
    {
      prefix: "/en/topic/fishing-and-angling",
      agency: "Prince Edward Island Department of Environment, Energy and Climate Action",
      regs: null,
    },
    {
      prefix: "/en/topic/angling",
      agency: "Prince Edward Island Department of Environment, Energy and Climate Action",
      regs: null,
    },
  ],
  "www2.gov.bc.ca": [
    {
      prefix: "/gov/content/sports-culture/recreation/fishing-hunting/fishing",
      agency: "British Columbia Ministry of Water, Land and Resource Stewardship",
      regs: null,
    },
  ],
  "www2.gnb.ca": [
    {
      prefix: "/content/gnb/en/departments/erd/natural_resources/",
      agency: "New Brunswick Department of Natural Resources and Energy Development",
      regs: null,
    },
  ],
};

/**
 * Tourism / commercial publisher domains. The cited URL is kept as
 * officialSourceUrl; we do not invent a managing agency from a CVB host.
 * Specific records may still receive an editorial government identity
 * via EDITORIAL_AGENCY below.
 */
const SKIP_DOMAINS = new Set([
  "destinfwb.com",
  "portaransas.org",
  "portisabelsouthpadre.com",
  "visitcorpuschristi.com",
  "navarrebeachpier.com",
]);

/**
 * Per-record government identity when the cited publisher is not the manager.
 * officialSourceUrl is not changed. Fishing-regulator vs site-operator:
 * mixed city/county corridors get the state fishing agency; a single named
 * municipal facility gets that municipality.
 * @type {Record<string, { agency: string, regs: string | null }>}
 */
const EDITORIAL_AGENCY = {
  // Horace Caldwell = Nueces County Coastal Parks; Roberts Point / Brundrett /
  // Charlie's Pasture = City of Port Aransas. Mixed site ownership → TPWD.
  "HHI-DEST-179": {
    agency: "Texas Parks and Wildlife Department",
    regs: "https://tpwd.texas.gov/regulations/outdoor-annual/",
  },
  // Marisol (Laguna Madre) Boat Ramp — City of South Padre Island (myspi.org).
  "HHI-DEST-183": {
    agency: "City of South Padre Island",
    regs: "https://tpwd.texas.gov/regulations/outdoor-annual/",
  },
  // Packery Channel Park boat ramp — City of Corpus Christi (named in access).
  "HHI-DEST-192": {
    agency: "City of Corpus Christi Parks and Recreation",
    regs: "https://tpwd.texas.gov/regulations/outdoor-annual/",
  },
  // Okaloosa Island Pier = Okaloosa County; Joe's Bayou = City of Destin.
  // Mixed site ownership → FWC.
  "HHI-DEST-227": {
    agency: "Florida Fish and Wildlife Conservation Commission",
    regs: "https://myfwc.com/fishing/",
  },
  // Navarre Beach Pier — Santa Rosa County (santarosa.fl.gov/248/Navarre-Beach-Pier).
  "HHI-DEST-239": {
    agency: "Santa Rosa County",
    regs: "https://myfwc.com/fishing/",
  },
};

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

const PORTAL_AGENCIES = new Set(
  Object.values(PATH_AGENCY).flatMap((rules) => rules.map((r) => r.agency)),
);

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(url) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

function canonUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}${u.search}`.toLowerCase();
  } catch {
    return (url || "").split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}

/** First matching path prefix on a portal host, else host-level agency map. */
function lookupAgency(host, pathname) {
  const rules = PATH_AGENCY[host];
  if (rules) {
    const p = pathname.toLowerCase();
    for (const rule of rules) {
      if (p === rule.prefix.toLowerCase() || p.startsWith(rule.prefix.toLowerCase())) {
        return [rule.agency, rule.regs];
      }
    }
    return null;
  }
  return DOMAIN_AGENCY[host] ?? null;
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

function stampReview(r) {
  if (!r.lastVerified) return;
  if (!r.regsReviewedDate) r.regsReviewedDate = r.lastVerified;
  if (!r.accessReviewedDate) r.accessReviewedDate = r.lastVerified;
}

const data = JSON.parse(readFileSync(DATA, "utf8"));
const byId = new Map(data.map((r) => [r.id, r]));

let already = 0;
let enriched = 0;
let reevaluated = 0;
let unfilled = 0;
let skippedTourism = 0;
let editorialFilled = 0;
let noMatch = 0;
const unmatchedHosts = {};
const pathHits = {};

for (const r of data) {
  const host = hostOf(r.officialSourceUrl || "");
  const pathname = pathOf(r.officialSourceUrl || "");

  const editorial = EDITORIAL_AGENCY[r.id];
  if (editorial) {
    if (!r.managingAgency) {
      r.managingAgency = editorial.agency;
      if (editorial.regs && !r.officialRegsUrl) r.officialRegsUrl = editorial.regs;
      stampReview(r);
      editorialFilled += 1;
    } else {
      already += 1;
    }
    continue;
  }

  if (SKIP_DOMAINS.has(host)) {
    skippedTourism += 1;
    continue;
  }

  const hit = lookupAgency(host, pathname);
  const isPortal = Boolean(PATH_AGENCY[host]);

  if (isPortal) {
    if (hit) {
      pathHits[host] = (pathHits[host] || 0) + 1;
      const [agency, regs] = hit;
      const wasEmpty = !r.managingAgency;
      const machine = !r.managingAgency || PORTAL_AGENCIES.has(r.managingAgency);
      if (machine) {
        if (r.managingAgency !== agency) {
          r.managingAgency = agency;
          if (wasEmpty) enriched += 1;
          else reevaluated += 1;
        } else if (wasEmpty) {
          enriched += 1;
        } else {
          already += 1;
        }
        if (regs && !r.officialRegsUrl) r.officialRegsUrl = regs;
        stampReview(r);
      } else {
        already += 1;
      }
    } else if (r.managingAgency && PORTAL_AGENCIES.has(r.managingAgency)) {
      r.managingAgency = null;
      unfilled += 1;
    } else if (r.managingAgency) {
      already += 1;
    } else {
      noMatch += 1;
      unmatchedHosts[`${host}${pathname}`] = (unmatchedHosts[`${host}${pathname}`] || 0) + 1;
    }
    continue;
  }

  if (r.managingAgency) {
    already += 1;
    continue;
  }
  if (!hit) {
    noMatch += 1;
    unmatchedHosts[host] = (unmatchedHosts[host] || 0) + 1;
    continue;
  }
  const [agency, regs] = hit;
  r.managingAgency = agency;
  if (regs && !r.officialRegsUrl) r.officialRegsUrl = regs;
  stampReview(r);
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
      portalReevaluated: reevaluated,
      portalUnfilled: unfilled,
      skippedTourismCvb: skippedTourism,
      editorialFilled,
      noDomainMatch: noMatch,
      unmatchedHosts,
      pathHits,
      total: data.length,
      withAgencyAfter: data.filter((r) => r.managingAgency).length,
      sameWaterbodyGroups: SAME_WATERBODY.length,
      sharedUrlGroups: urlGroups,
      recordsWithRelated: withRelated,
      relatedLinkCount: relatedLinks,
    },
    null,
    2,
  ),
);
