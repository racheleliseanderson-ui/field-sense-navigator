# Enrichment pass — 2026-08-19

Full systematic traversal of the 518-water catalog + second-pass audit completed.

## (c) User-initiated public-safe packet

**Status: already production-ready.**

- Route: `/packet/$id`
- PDF export via `src/lib/packet-pdf.ts`
- Job-aware checklist, layer digest with confidence + residual unknowns
- `buildHandoff()` for Horizon Desk / Trip Prep
- Fail-closed: no coordinates, no private spots, no catch claims, no live gauge as truth

No code change required for the packet contract itself.

## (b) Relationships and tags

**Schema (additive, non-breaking)** — `src/lib/catalog.ts` schema 0.5.1:

```ts
related?: RelatedWater[] | null;
tags?: string[] | null;
```

`RelatedWater.relation` values:
- `same_waterbody_segment`
- `adjacent_public_corridor`
- `shared_agency_page`
- `parent` / `child`

Runtime tags continue to be derived by `readTags()` in `intelligence.ts` (hazards, crowd, seasonal, access). Stored `tags` are optional controlled vocabulary for filtering/search.

**Candidates identified (not auto-written):**
- 32 base-name multi-record groups
- 89 shared-`officialSourceUrl` groups

Editorial review required before linking.

## (a) Agency / regs / identifier fields

**High-confidence fill script:** `scripts/enrich-agency-from-domains.mjs`

Maps primary domains already present in `officialSourceUrl` → `managingAgency` (+ `officialRegsUrl` where a clear regs landing page exists). Only fills null fields. Stamps `regsReviewedDate` / `accessReviewedDate` from `lastVerified` when present.

| Metric | Count |
|--------|------:|
| Already had `managingAgency` | 24 |
| Newly fillable from domain map | 349 |
| No high-confidence domain match (left null) | 145 |
| Total records | 518 |

**Run:**

```bash
node scripts/enrich-agency-from-domains.mjs
```

Re-check output summary before committing the updated `destinations.json`.

USGS / NOAA / NDBC IDs remain sparse by design; populate only from verified station bindings (see existing `scripts/resolve-stations.mjs` and `station-bindings.json`).

## Remaining human review

1. Run the enrichment script and commit the resulting `destinations.json` after visual spot-check.
2. Review the 145 unmatched domains for additional high-confidence agency mappings.
3. Editorial decisions on parent/child and same-corridor links (do not auto-merge).
4. Optional: surface `managingAgency` and `officialRegsUrl` more visibly on water cards and the packet footer.

## Principles preserved

- Accuracy outranks completeness.
- Public waters only; 0 private spots.
- No invented facts, coordinates, or live condition claims.
- Additive and reversible changes only.
