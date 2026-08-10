# Mobile Records, National Coverage, Live Official Feeds

Three tracks, delivered in order. The public-waters-only, fail-closed doctrine holds: nothing invented, every number attributed to a named official source, every unknown stated.

## 1. Water record and field packet on a phone

Both pages are currently built for a wide desk. They get rebuilt for the hand.

- Record header reflows: waterbody name, state, and ID stack without clipping; the readiness meter moves above the fold as a full-width band.
- The five intelligence layers become a touch accordion — one open at a time, each with a large tap target, confidence and residual unknowns visible when opened.
- Sticky bottom action bar on the record: Download PDF, Open packet, Carry forward. Thumb-reachable, no scrolling back up.
- "Carry forward" gets a visible confirmation state instead of a silent clipboard write.
- Field packet reflows to a single phone column: checklist rows become large checkable lines, the layer digest stacks, the print button gives way to Download PDF. The paper aesthetic is preserved, not flattened.
- All controls sized for touch, no hover-only affordances, long waterbody names truncate instead of collapsing the row.

## 2. Additional waters — Great Lakes, Northeast, then national

- First pass deepens the thin states already present and adds the missing Great Lakes and Northeast states: Wisconsin, Michigan, New York, Ohio, Pennsylvania, Illinois, Indiana, Vermont, New Hampshire, Massachusetts, Rhode Island, Connecticut, New Jersey.
- Second pass is a broad national sweep so every remaining state is represented at a smaller per-state depth.
- Each new record carries the same shape as existing ones: official source URL, verification date, status, species context, published access sites, current notices, direct-verification steps, and privacy classification. Any water that cannot be tied to an official agency page is not added.
- A state coverage index view shows depth per state and names where coverage is thin, rather than implying uniform authority.

## 3. Smarter data sources

**Live official feeds.** Each water is mapped to named official stations — USGS streamflow and lake level, NOAA/NWS weather and marine forecasts, NOAA tide stations where applicable. Readings display with station name, station ID, and observation timestamp. Waters with no matching station say so explicitly rather than borrowing a nearby one.

**Interpreted with confidence.** Readings feed the hazard layer and the readiness score, and every derived value shows its inputs: which station, which reading, how old, and how much it moved the score. A stale or unreachable feed lowers confidence and is named as an unknown — it never silently defaults to favorable. Feeds are agency observations, never a fishing prediction.

**Richer static agency data.** Additional fields harvested from state agency pages: stocking records, regulation exceptions, launch fees, ADA and accessible access, and season windows.

**Source quality grading.** Every record gets a visible integrity band: source authority, verification age, review-overdue state, notice volatility, and live-feed availability, so a reader can judge how much weight the record carries.

## Technical notes

- Feeds are fetched server-side through TanStack server functions with short caching, so no keys or cross-origin calls reach the browser; USGS and NWS are keyless public APIs.
- Station mapping is a data file keyed by record ID, hand-verified — no automatic nearest-station guessing.
- Live-data score contributions are pure functions in `src/lib/intelligence.ts` that return their inputs alongside the output.
- The catalog stays a versioned JSON file through the Great Lakes/Northeast pass; the national sweep is the point at which Lovable Cloud takes over storage if the file outgrows it.

## Order of work

Mobile record and packet first, then the Great Lakes/Northeast waters and coverage index, then live feeds with source grading, then the national sweep and the richer agency fields.