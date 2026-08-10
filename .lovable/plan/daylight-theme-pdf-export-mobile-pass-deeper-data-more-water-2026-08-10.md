# Daylight Theme, PDF Export, Mobile Pass, Deeper Data, More Waters

Five upgrades to Honey Hole Intelligence, staged so each lands complete before the next. The public-waters-only, fail-closed doctrine is unchanged: nothing invented, every claim attributed, every unknown named.

## 1. Light / dark toggle

Dark instrument stays the signature and the default. Light is a crafted "field daylight" mode built from the existing printed-packet paper palette — warm off-white ground, deep navy ink, brass held at readable contrast — not an inverted dark theme.

- Toggle sits in the header as a small instrument switch; the choice is remembered between visits.
- No flash of the wrong theme on first paint.
- Every signal color (clear / watch / flagged / restricted) gets a separate daylight value so status language stays legible on paper-white.
- Hero imagery and gradients get daylight treatments rather than being dropped.

## 2. True PDF export of the Field Packet

Today the packet relies on the browser print dialog. It becomes a real one-click download.

- "Download PDF" button on the packet and on every water record produces a paged, A4/Letter briefing document with cover header, record ID, issue timestamp, checklist, layer digest, hazards, source URL, and the boundary statement.
- Page breaks respect section boundaries — no checklist split across pages, no orphaned headings.
- Multi-water export: a shortlist can be exported as one packet with a contents page.
- Print stylesheet stays as the fallback.

## 3. Mobile compatibility pass

Every route audited at phone width, not just shrunk.

- Header collapses to a compact bar with a slide-in nav and the theme switch reachable one-handed.
- Explore filters become a bottom sheet instead of a stacked rail; cards go single-column with the readiness meter and status line kept above the fold.
- Plan a Day becomes a step-by-step flow with a sticky footer action, one decision per screen.
- Water record layers become an accordion; the packet sheet reflows to phone width and the PDF download replaces the print button.
- Text rows use the grid + truncate pattern so long waterbody names never clip or collapse.

## 4. Deeper derived intelligence

Richer readouts computed from the catalog already held — no invention, all traceable to the record.

- Access anatomy: launch-type mix, hand-launch vs trailer capability, pier and shore availability, published-site counts, and what is absent.
- Species seasonality context, and which species drive the regulatory notices on that water.
- Pressure profile: published-site count, notice density, and metro-adjacent language combined into a crowding read with stated confidence.
- Record integrity: verification age, review-overdue state, notice volatility, and source authority, surfaced as a data-quality band on every layer.
- Every derived value carries its inputs, so a reader can see why a number moved.

## 5. More waters, and views that use them

- Expand beyond the current 277 records with additional public waters pulled from state agency pages, each carrying the same source URL, verification date, notices, access fields, and privacy classification as existing records. Any water that cannot be sourced to an official page is not added.
- New views: a state coverage index, a species finder, side-by-side comparison of up to three waters, and a saved shortlist that feeds Plan a Day and the PDF export.
- Season, month, and time of day reshape what each water leads with — spawning-window notices, heat or ice advisories, legal-hours windows against your time budget.

## Technical notes

- Theme is a CSS token layer in `src/styles.css` (`:root` daylight, `.dark` instrument) plus an inline pre-hydration script; components already use semantic tokens, so no color literals need touching.
- PDF generation runs client-side from the existing packet markup, so no backend is required for it.
- Derived intelligence extends `src/lib/intelligence.ts` with pure functions and explicit confidence inputs.
- The expanded catalog stays a versioned data file unless the record count outgrows it, at which point Lovable Cloud can hold it.

## Not included

Live gauge, flow, tide, weather, and hatch feeds are out of scope for this round — they would need per-water official station mapping. Say the word and they become their own stage.

## Order of work

Theme, then PDF export, then the mobile pass, then derived intelligence, then catalog expansion and the new views.
