# Pipeline controls, accessibility audit, and immersive editorial pass

The instrument already has the pipeline console, comparison tray, wizard and catalog.
This pass deepens the run controls, audits the build for accessibility and flow, and
raises the visual register without loosening the fail-closed voice.

## 1. Pipeline run management

Current console runs a single sequential probe with start/stop. Extend it into a real
run manager:

- Run states: idle, running, paused, stopped, complete — with pause/resume, not just stop.
- Concurrency control (1 / 3 / 6 parallel probes) and a retry action for failed rows.
- Per-run record: started at, duration, scope, matched / unmatched / error counts,
  kept as a short run history (last 5 runs, in-session) so results are comparable.
- Live row streaming with status filter chips (all / matched / unmatched / error) and a
  "re-run failures only" control.
- Export the run as CSV and as a PDF integrity brief using the existing packet PDF engine.
- Empty and interrupted states written plainly: a stopped run reports what it did not reach.

## 2. Interactive elements

- Keyboard command palette (Cmd/Ctrl-K): jump to a water, a state, plan, compare, pipeline.
- Sticky compare tray with drag-free add/remove and a count badge across all routes.
- Explore: hover/focus preview of a water's five layer confidences without leaving the grid.
- Water record: sticky layer navigator that tracks scroll position.
- Reduced-motion respected everywhere; every interaction reachable by keyboard.

## 3. Accessibility and flow audit

Audit every route (index, explore, plan, water, packet, compare, watchlist, pipeline)
and report findings by severity before fixing:

- Single `<main>` per route, correct heading order, landmark structure.
- Icon-only buttons get labels; all filter controls get associated labels.
- Focus-visible rings on every control; no focus traps in the mobile filter sheet.
- 44px tap targets on mobile; no horizontal overflow at 360px.
- Status never carried by color alone (shape chips already exist — extend to pipeline rows).
- Verify contrast in all five modes: dark, daylight, high-contrast black, high-contrast
  white, color-blind safe.

Flow: confirm each route has one obvious next action — explore to record, record to packet,
packet to trip prep handoff, plan to ranked results to packet.

## 4. Aesthetic: luxury editorial + immersive instrument

- Typographic hierarchy tightened: display headline scale, a true editorial sub-deck, and
  data set in the mono face at consistent optical size. Fewer weights, more contrast.
- Immersive full-bleed image moments on index, water record and plan results, with
  parallax and dark-to-light chapter transitions (motion-gated).
- Layered composition instead of card grids: asymmetric explore rows, offset section marks,
  hairline rules used as instrument scale rather than decoration.
- Pipeline console reads as an operations panel: monospaced ledger, live progress bar,
  quiet color signalling.
- Tone rule enforced in every new string: state what is known, name the unknown, no
  guarantees, no lifestyle copy.

## Technical notes

- Run manager lives in `src/lib/pipeline.ts` (state machine + history), UI in
  `src/routes/pipeline.tsx`; probes keep using `getLiveConditions`.
- Concurrency via a bounded worker pool with an abort flag; no new dependency.
- CSV export client-side; PDF export reuses `src/lib/packet-pdf.ts`.
- Command palette built on existing shadcn `command` primitive.
- Verification with Playwright screenshots at 1280px and 390px, in dark, daylight and
  high-contrast modes.
