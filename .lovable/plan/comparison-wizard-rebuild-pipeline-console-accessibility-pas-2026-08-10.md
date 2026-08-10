# Comparison, Wizard Rebuild, Pipeline Console, Accessibility Pass

Current state: 318 named public waters across 23 states, guided planning at `/plan`, catalog at `/explore`, water records, packets, watchlist. This round adds coverage, a comparison instrument, a rebuilt wizard, visible data-pipeline controls, and a full layout/accessibility audit — all under the unchanged doctrine: public waters only, nothing invented, every claim attributed, every unknown named.

## 1. Additional waters

Add roughly 80–110 records to reach broad national coverage, prioritising the states with thin or no representation: the South (GA, SC, NC, TN, KY, AL, MS, LA, AR, MO, OK), the Plains and Mountain West (KS, NE, IA, SD, ND, WY, UT, NV, NM, AZ), the mid-Atlantic (VA, WV, MD, DE), plus Alaska and Hawaii. Each record carries the same shape as existing ones: official agency source URL, verification date and next review, published access sites with launch type, current notices in the agency's own words, direct-verification steps, species context, and privacy classification. Any water that cannot be tied to an official agency page is not added.

## 2. Compare waters side by side

New `/compare` route holding up to four waters at once.

- Aligned rows: readiness and band, verification age, access anatomy, hazards, capacity signals, seasonal and regulatory notices, field-check load, source authority.
- Differences are marked, not just displayed — the row shows which water leads, which is unknown, and where the two records disagree in confidence rather than in fact.
- Waters enter comparison from the catalog, a water record, or the watchlist; the selection lives in the URL so a comparison is shareable.
- Exports as a single comparison PDF in the same briefing typography as the field packet.

## 3. Day plan wizard, rebuilt

The existing three-step planner becomes a proper guided instrument.

- Job, then constraints, then window (season/month/time of day and travel radius), then ranked results, then a packet.
- A persistent progress rail states what has been declared and what it changes; every step is reversible without losing later answers.
- Ranked results explain themselves inline: which constraint moved the score, which excluded a water outright.
- The wizard ends with three explicit handoffs: field packet PDF, add to watchlist, carry forward to Horizon Desk / Trip Prep.
- State survives reload and is shareable by URL.

## 4. Interactive elements

- Layer panels get inline detail-on-demand: tap a signal to see the inputs and the residual unknowns behind it.
- Readiness meter becomes interrogable — hover or tap a segment to see its contribution and its confidence.
- Catalog gains quick-compare and quick-watch actions on each card without leaving the grid.
- Filter chips, sort, and comparison slots animate under the existing motion gate and stay fully usable with reduced motion on.

## 5. Pipeline run controls

A `/pipeline` console that makes the data machinery legible and operable from the interface.

- Catalog integrity run: records past review date, missing fields, stale verification, notice volatility, source-authority distribution — reported as counts with the offending records listed.
- Live-feed run: re-resolves USGS station matches and NWS forecasts across the catalog or a selected subset, showing matched, unmatched, and failed, with the reason for each.
- Every run shows started/finished time, scope, and a plain result line; runs can be cancelled and are never presented as more authoritative than the agency page.
- No run invents data. A failed fetch is reported as a failure, not as an absence of hazard.

## 6. Mobility, accessibility, layout and flow assessment

- Audit every route at phone, tablet and desktop widths: tap targets at 44px, no clipping on long waterbody names, grid + `min-w-0` + `truncate` on every mixed text/widget row.
- Keyboard path through the wizard, comparison, filters and pipeline console; visible focus everywhere; correct heading order; one `<main>` per page; live regions for run status and filter result counts.
- Verify the black, white and colour-blind display modes against the new surfaces, including the comparison table and pipeline console.
- Written assessment delivered at the end: what passes, what was fixed, what remains and why.

## Aesthetic

Luxury editorial meeting a precise decision tool. Strong typographic hierarchy — display weight for waterbody names, monospaced numerics for every measured value, small-caps ticks for labels. Full-bleed treated imagery at chapter openings, generous rests between dense readouts, brass held for the single most important value on a screen. Voice stays precise, honest and slightly dry: no lifestyle copy, no marketing softness, no implied certainty about fish, weather or conditions the record cannot verify.

## Technical notes

- Comparison and wizard state are URL-backed via the existing search-param pattern in `explore.tsx`.
- Comparison and pipeline reads extend `src/lib/intelligence.ts` with pure functions; live re-resolution reuses `readLive` in `src/lib/live.server.ts` behind a batched server function with concurrency limits.
- Comparison PDF extends `src/lib/packet-pdf.ts`.
- New records go into `src/data/destinations.json`; if the file becomes unwieldy at that size it splits by region behind the same `catalog.ts` API.

## Order of work

Waters, then compare, then the wizard rebuild, then interactive elements, then the pipeline console, then the accessibility pass and written assessment.
