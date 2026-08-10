# Touch, Motion, Display Modes, Bilingual Shell, Sharper Search

Five upgrades to the instrument. Nothing touches the doctrine: public waters only, official source wording preserved, fail closed where a check cannot be completed.

## 1. Touch-friendly interactions everywhere

Every control becomes a real thumb target, not a shrunken desktop one.

- Minimum 44px tap height on all filters, chips, selects, nav links, checkboxes and toggles across the catalog, planner, record and packet.
- Catalog filters move into a swipe-up bottom sheet on phones with a live match count and a one-tap "clear all"; the desktop rail is unchanged.
- Planner steps get a sticky footer action and full-width option cards you can hit without aiming.
- Swipe left/right between intelligence layers on a water record; taps still work identically.
- Active/pressed states are visible on touch, not just hover, and long labels truncate instead of collapsing.

## 2. Cinematic motion

Motion becomes part of the art direction, always subordinate to reading the record.

- Hero: slow scroll-linked parallax on the water imagery, scrim deepening as you scroll, title lines rising in sequence.
- Section reveals as you scroll: image crops opening, hairline rules drawing in, headings staged.
- Readiness scores count up and meters fill on first view; layer panels expand with weight rather than snapping.
- Card hover and press lift, brass edge catch, and a soft image push.
- Page transitions between catalog, record and packet feel like turning to a new sheet.
- Everything honors "reduce motion" — the OS setting and the in-app control both cut it to instant.

## 3. Black, white and color-blind display modes

Two current grounds (dark instrument, field daylight) become five, chosen from one display control in the header.

- **High-contrast black** — pure black ground, white text, brass replaced by a high-luminance amber. Well past AA.
- **High-contrast white** — pure white ground, near-black ink, heavy rules.
- **Color-blind safe** — signal colors move to a blue/orange scale that reads under deuteranopia, protanopia and tritanopia. Status is never carried by color alone: every clear / watch / flagged / restricted chip also carries a distinct shape mark and its word.
- Choice is remembered, applied before first paint, and drives the PDF export palette so a printed packet matches the screen.

## 4. Language switcher (English / Spanish, interface only)

- Every piece of interface language — navigation, headings, layer titles, readouts, checklist actions, buttons, empty states — is translated.
- Waterbody names, agency notices, source text and the boundary statement stay in their published English wording, each marked as source text with a short line explaining that official language is quoted, not translated.
- The switch sits beside the display control, remembers the choice, and sets the page language attribute for screen readers.
- The field packet and PDF follow the selected interface language.

## 5. Refined search

The catalog search stops being a name match.

- Searches waterbody, access site, county, region, state, water type and species in one field, with typo tolerance and ranked results — a closest-match line when nothing hits exactly.
- Typed filters from plain text: "kayak Texas", "trout river", "pier access" resolve into the right facets automatically, shown as removable tokens.
- Instant suggestions as you type, grouped by water, state and species, keyboard and thumb navigable.
- Sort control: readiness, recently verified, alphabetical, state.
- Search state lives in the URL, so a filtered catalog can be shared or reopened.
- Recent searches and an obvious empty state that suggests the nearest workable query.

## Technical notes

- Display modes extend the existing token layer in `src/styles.css` as additional ground classes plus a signal-shape system; the pre-hydration script is widened from two themes to five.
- Motion uses CSS transitions, scroll-driven animation and the existing utility set, gated behind `prefers-reduced-motion` and the in-app control. No heavyweight animation dependency unless a specific sequence needs it.
- Translation is a small typed dictionary with a `useT()` hook — no i18n framework, no network fetch, both languages shipped in the bundle.
- Search adds a prebuilt index and a scoring function in a new `src/lib/search.ts`, with filter state moved to validated URL search params.

## Order of work

Display modes and accessibility first (they change tokens everything else uses), then touch interactions, then motion, then search, then the bilingual shell.