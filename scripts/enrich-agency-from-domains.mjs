#!/usr/bin/env node
/**
 * High-confidence enrichment of managingAgency / officialRegsUrl from the
 * primary domains already present in officialSourceUrl.
 *
 * Rules:
 * - Only fill when the field is currently null/empty.
 * - Only map domains with a clear, primary agency identity.
 * - Never invent agencies or regs URLs.
 * - Stamps regsReviewedDate / accessReviewedDate from lastVerified when set.
 *
 * Usage:
 *   node scripts/enrich-agency-from-domains.mjs
 *   (reads src/data/destinations.json, writes in place, prints summary)
 *
 * Accuracy outranks completeness. Unmatched domains stay null for human review.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const raw = readFileSync(DATA, "utf8");
const data = JSON.parse(raw);

let already = 0;
let enriched = 0;
let noMatch = 0;

for (const r of data) {
  if (r.managingAgency) {
    already += 1;
    continue;
  }
  const host = hostOf(r.officialSourceUrl || "");
  const hit = DOMAIN_AGENCY[host];
  if (!hit) {
    noMatch += 1;
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

writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      alreadyHadAgency: already,
      newlyEnriched: enriched,
      noDomainMatch: noMatch,
      total: data.length,
      withAgencyAfter: already + enriched,
    },
    null,
    2,
  ),
);
