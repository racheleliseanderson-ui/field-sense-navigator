# Enrichment pass — 2026-08-19 (completed)

Full systematic traversal of the 518-water catalog. Accuracy outranks completeness.
Additive only: no invented coordinates, no private spots, no live-condition claims,
no destructive merges.

## Agency / regs fill

Script: `scripts/enrich-catalog.mjs`

Maps `officialSourceUrl` host → `managingAgency` (+ `officialRegsUrl` when a
clear fishing/regs landing page is already cited or is the agency's published
fishing page). Only fills null fields. Stamps review dates from `lastVerified`.

| Metric | Count |
|--------|------:|
| Already had `managingAgency` | 24 |
| Newly filled from domain map | 489 |
| Tourism / CVB domains left null | 5 |
| Unmatched after second-pass map | 0 |
| **With agency after this pass** | **513 / 518** |

Left null on purpose (publisher is not the managing agency):

- destinfwb.com
- portaransas.org
- portisabelsouthpadre.com
- visitcorpuschristi.com
- navarrebeachpier.com

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
