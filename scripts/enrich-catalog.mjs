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
 *   if the path no longer matches. Host matches also fill missing regs even
 *   when agency is already set.
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
  "floridastateparks.org": ["Florida State Parks", "https://myfwc.com/fishing/"],
  "myfwc.com": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "gis.myfwc.com": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "ocean.floridamarine.org": ["Florida Fish and Wildlife Conservation Commission", "https://myfwc.com/fishing/"],
  "wildlife.ca.gov": ["California Department of Fish and Wildlife", "https://wildlife.ca.gov/Fishing"],
  "nps.gov": ["National Park Service", null],
  "mffp.gouv.qc.ca": ["Ministère des Forêts, de la Faune et des Parcs (Québec)", null],
  "dnr.wisconsin.gov": ["Wisconsin Department of Natural Resources", "https://dnr.wisconsin.gov/topic/Fishing"],
  "dec.ny.gov": ["New York State Department of Environmental Conservation", "https://www.dec.ny.gov/outdoor/fishing.html"],
  "albertaregulations.ca": ["Alberta Environment and Parks", null],
  "wlf.louisiana.gov": ["Louisiana Department of Wildlife and Fisheries", "https://www.wlf.louisiana.gov/page/seasons-regulations"],
  "ohiodnr.gov": ["Ohio Department of Natural Resources", "https://ohiodnr.gov/rules-and-regulations/recreation-rules/fishing-rules"],
  "parksandrecreation.idaho.gov": ["Idaho Department of Parks and Recreation", null],
  "dep.nj.gov": ["New Jersey Department of Environmental Protection", "https://dep.nj.gov/njfw/"],
  "dnr.sc.gov": ["South Carolina Department of Natural Resources", "https://www.dnr.sc.gov/regulations.html"],
  "outdooralabama.com": ["Alabama Department of Conservation and Natural Resources", "https://www.outdooralabama.com/fishing"],
  "dwr.virginia.gov": ["Virginia Department of Wildlife Resources", "https://dwr.virginia.gov/fishing/regulations/"],
  "dnr.maryland.gov": ["Maryland Department of Natural Resources", "https://dnr.maryland.gov/fisheries/pages/regulations/index.aspx"],
  "adfg.alaska.gov": ["Alaska Department of Fish and Game", "https://www.adfg.alaska.gov/index.cfm?adfg=fishregulations.main"],
  "myodfw.com": ["Oregon Department of Fish and Wildlife", "https://myodfw.com/fishing"],
  "fishandboat.com": ["Pennsylvania Fish and Boat Commission", "https://www.pa.gov/agencies/fishandboat/fishing/regulations"],
  "dnr.illinois.gov": ["Illinois Department of Natural Resources", "https://www.ifishillinois.org/"],
  "parks.ca.gov": ["California State Parks", "https://wildlife.ca.gov/Fishing"],
  "wildlife.nh.gov": ["New Hampshire Fish and Game Department", "https://www.wildlife.nh.gov/fishing-new-hampshire"],
  "georgiawildlife.com": ["Georgia Department of Natural Resources", "https://georgiawildlife.com/fishing/angler-resources"],
  "ncwildlife.gov": ["North Carolina Wildlife Resources Commission", "https://www.ncwildlife.gov/fishing"],

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
  "wildlife.utah.gov": ["Utah Division of Wildlife Resources", "https://wildlife.utah.gov/guidebooks"],
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
