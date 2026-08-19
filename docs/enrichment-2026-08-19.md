# Enrichment pass — 2026-08-19 (completed)

Full systematic traversal of the 518-water catalog. Accuracy outranks completeness.
Additive only: no invented coordinates, no private spots, no live-condition claims,
no destructive merges.

## Agency / regs fill

Script: `scripts/enrich-catalog.mjs`

Two lookup tables, in order:

1. **Path map** (`PATH_AGENCY`) — statewide / whole-of-government portals. The
   hostname is not an agency. A fill is earned only when the cited URL path
   starts with a known department prefix (case-insensitive). First matching
   prefix wins. Used for `in.gov` (`/dnr/`), `tn.gov` (`/twra/`), and the other
   generic portals listed below.
2. **Host map** (`DOMAIN_AGENCY`) — hostname *is* the agency (`wdfw.wa.gov`,
   `fw.ky.gov`, `nps.gov`, …). No path required.

Only fills null fields on host-mapped records. Portal hosts are re-evaluated
on each run so a later URL that is merely `tn.gov/something-else` cannot keep
a TWRA stamp. Editorial names that are *more specific* than the path map
(e.g. CT DEEP — Marine Fisheries) are left untouched.

Review dates stamp from `lastVerified` when present.

| Metric | Count |
|--------|------:|
| Already had `managingAgency` | 24 |
| Newly filled from domain/path map | 489 |
| Tourism / CVB domains left unmapped at host level | 5 |
| Editorial government identity on those five records | 5 |
| Unmatched after second-pass map | 0 |
| **With agency after this pass** | **518 / 518** |

### Portal path prefixes (current catalog)

Every current record on these hosts already sat on a matching prefix, so
tightening the gate did not drop any fill. The gate is for the next record
that cites a generic homepage.

| Host | Required path prefix | Agency |
|---|---|---|
| `in.gov` | `/dnr/` | Indiana DNR |
| `tn.gov` | `/twra/` | Tennessee Wildlife Resources Agency |
| `michigan.gov` | `/dnr/` | Michigan DNR |
| `maine.gov` | `/ifw/` | Maine IFW |
| `mass.gov` | `/freshwater-fishing` | MassWildlife |
| `mass.gov` | `/guides/recreational-saltwater-fishing`, `/info-details/recreational-saltwater-fishing` | Mass. DMF |
| `portal.ct.gov` | `/deep/` | CT DEEP |
| `ontario.ca` | `/document/ontario-fishing-regulations-summary`, `/page/fishing` | Ontario MNRF |
| `gov.mb.ca` | `/nrnd/fish-wildlife/fish/` | Manitoba NRND |
| `gov.nl.ca` | `/ffa/` | NL FFA |
| `yukon.ca` | `/en/fishing-licences-and-regulations`, `/en/fishing-regulations-summary` | Yukon Environment |
| `gov.nu.ca` | `/en/environment/` | Nunavut Environment |
| `gov.nt.ca` | `/ecc/` | NWT ECC |
| `saskatchewan.ca` | `/residents/…/angling/` | Saskatchewan Environment |
| `novascotia.ca` | `/fish/sportfishing` | NS Fisheries |
| `princeedwardisland.ca` | `/en/topic/fishing-and-angling`, `/en/topic/angling` | PEI Environment |
| `www2.gov.bc.ca` | `/gov/content/sports-culture/recreation/fishing-hunting/fishing` | BC WLRS |
| `www2.gnb.ca` | `/content/gnb/en/departments/erd/natural_resources/` | NB NRED |

Left null from host mapping (publisher is not the managing agency):

- destinfwb.com
- portaransas.org
- portisabelsouthpadre.com
- visitcorpuschristi.com
- navarrebeachpier.com

Those five records received a separate **editorial** government identity
(`EDITORIAL_AGENCY` in the script). `officialSourceUrl` is unchanged.

| Record | Water | Managing agency | Why |
|---|---|---|---|
| HHI-DEST-179 | Port Aransas pier corridor | Texas Parks and Wildlife Department | Mixed site ownership (Nueces County Horace Caldwell + City of Port Aransas free piers). TPWD governs fishing on all of them. |
| HHI-DEST-183 | Marisol / Lower Laguna Madre | City of South Padre Island | City-owned ramp (`myspi.org` project). TPWD Outdoor Annual as regs. |
| HHI-DEST-192 | Packery Channel | City of Corpus Christi Parks and Recreation | Named municipal ramp. TPWD Outdoor Annual as regs. |
| HHI-DEST-227 | Destin / Okaloosa Island | Florida Fish and Wildlife Conservation Commission | Mixed site ownership (Okaloosa County pier + City of Destin Joe's Bayou). FWC governs fishing. |
| HHI-DEST-239 | Navarre Beach Fishing Pier | Santa Rosa County | County pier page at `santarosa.fl.gov`. FWC as regs. |

**With agency after editorial pass: 518 / 518.**

## Official regulations

Host/path/editorial fills first. Remaining empty `officialRegsUrl` values were
USFS / NPS / BLM / USBR / USACE and local parks — land managers, not fishing
agencies. Fishing on those sites is still state- or province-governed.

`STATE_REGS` stamps a verified statewide / provincial fishing-regs landing
**only when `officialRegsUrl` is still empty**. No invented per-waterbody
source. Weak homepages (Utah DWR guidebook index, Mono, Aurora) stay as cited
`officialSourceUrl`; they are not rewritten.

| Metric | Count |
|--------|------:|
| Host/path/editorial regs | 483 |
| Statewide/provincial fallback (`STATE_REGS`) | 35 |
| **With `officialRegsUrl` after this pass** | **518 / 518** |

Alberta: `https://albertaregulations.ca/fishingregs/`
Quebec: `https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/peche-sportive`

## Related links

Written, not just candidate lists. Homonyms were excluded.

| Relation | Groups / links | Rule |
|---|---|---|
| `same_waterbody_segment` | 21 groups / 90 links | Editorial. Same physical water across access/jurisdiction records. Lake Erie / Superior stay here. |
| `parent` / `child` | 7 groups / 10 pairs | Named access, arm, or outlet vs the parent water. Upgrades a prior `shared_agency_page` via `RELATION_RANK`. |
| `shared_agency_page` | 89 groups / 874 links | Exact `officialSourceUrl` match, including statewide directories. |

Parent / child groups (parent keeps the larger named water):

| Parent | Children |
|---|---|
| HHI-DEST-010 Tampa Bay | 214, 219 |
| HHI-DEST-007 Charlotte Harbor | 218 |
| HHI-DEST-026 Galveston Bay | 174, 184 |
| HHI-DEST-037 Skagit River | 135 |
| HHI-DEST-113 Payette Lake | 138 |
| HHI-DEST-120 Moosehead | 124 |
| HHI-DEST-015 Lake Michigan | 014 Green Bay, 280 Milwaukee |

Homonyms **not** linked: Clear Lake (WA / CA / IA), Pyramid Lake (CA DWR vs NV),
Rainy Lake WA (North Cascades) vs Rainy Lake MN/ON. Rainy Lake MN + ON **are** linked.

Records are never merged. Each keeps its own source, review date, and packet.

| Metric | Count |
|--------|------:|
| Records with `related[]` | 319 |
| Total related links | 984 |

## Catalog tags

Derived only from documented fields (`waterType`, `managingAgency` keywords,
`publicAccess` name/type text). Never estimated live state. Filled only when
`tags[]` is empty.

| Tag | Count | Source |
|---|---|---|
| `lake` / `reservoir` / `river` / `marine` | 128 / 165 / 133 / 92 | `waterType` |
| `boat_ramp` | 375 | access anatomy (`ramp`, `boat launch`) |
| `shore_access` | 348 | access anatomy (`shore`, `bank`, `wading`) |
| `pier` | 57 | access anatomy (`pier`) |
| `national_forest` | 19 | agency contains Forest Service |
| `state_park` | 18 | agency contains "state park" |
| `national_park` | 8 | agency contains "national park" |
| `blm` / `usbr` / `usace` | 3 / 3 / 1 | agency keywords |

**518 / 518 records carry `tags[]`.**

## UI

- Water cards: managing agency under the status/freshness line; up to four
  non-type catalog-tag chips
- Water record: agency in the readout band; official-regs link; related-waters
  list; catalog-tag strip (chips link to catalog filters)
- Compare: managing-agency row
- Field packet + PDF: agency, regs URL, and catalog tags in the source block
- Catalog explore: **Catalog tags** chip row (`pier`, `boat ramp`, `shore
  access`, `state park`, `national park`, `national forest`) as `?tag=`
- Search: tags in the index blob; "state park" / "national forest" tokenize as
  tag facets (pier/ramp stay access tokens)

## Constraints held

- Tourism CVB hosts are not mapped as agencies
- `officialSourceUrl` is never invented
- Homonyms are excluded from related links
- Accuracy outranks completeness; additive and reversible only
