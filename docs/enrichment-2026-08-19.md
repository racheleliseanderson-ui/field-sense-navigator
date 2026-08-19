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

## Related links

Written, not just candidate lists. Homonyms were excluded.

| Relation | Groups | Rule |
|---|---|---|
| `same_waterbody_segment` | 21 | Editorial. Same physical water across access/jurisdiction records. |
| `shared_agency_page` | 89 | Exact `officialSourceUrl` match, including statewide directories. |

Homonyms **not** linked: Clear Lake (WA / CA / IA), Pyramid Lake (CA DWR vs NV),
Rainy Lake WA (North Cascades) vs Rainy Lake MN/ON. Rainy Lake MN + ON **are** linked.

Records are never merged. Each keeps its own source, review date, and packet.

## UI

- Water cards: managing agency under the status/freshness line
- Water record: agency in the readout band; official-regs link; related-waters list
- Compare: managing-agency row
- Field packet + PDF: agency and regs URL in the source block and packet footer
- Handoff block: agency / regs lines when recorded
