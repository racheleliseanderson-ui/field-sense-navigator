# Field Sense Navigator — Waterways

The Hook the Horizon intelligence layer for **understanding and choosing water**.

- Live: <https://waterways.hookthehorizon.blog>
- Publication: [Hook the Horizon](https://hookthehorizon.blog)

Field Sense answers the first question in the Hook workflow: *where should I
fish, what kind of water is it, what should I look for there, which species are
relevant, and where does this go next?* It is a catalog of **named public
waters** with published access, read through five documented layers, a standing
water-reading craft layer, and an access-and-logistics layer — then handed
forward to the instrument that answers the next question.

## Doctrine

Public waters only. Fail closed. Accuracy outranks completeness.

No private spots. No coordinates. No catch guarantees. No invented gauge, flow,
tide, weather or hatch data. Where a check cannot be completed, the water is
treated as not ready to go, and the tool says so rather than filling the gap.

`AGENTS.project.md` is the governing document for architecture, cadence and
scope. Read it before changing the data layer, the build or the ingest.

## What the application holds

| Area | Where |
| --- | --- |
| Catalog contract and jurisdictions | `src/lib/catalog.ts` (+ `src/data/`) |
| Five documented layers, readiness, job ranking, checklists | `src/lib/intelligence.ts` |
| Water-reading craft by water class | `src/lib/water-reading.ts` |
| Access, launches and logistics | `src/lib/access.ts` |
| Search, facets and suggestions | `src/lib/search.ts` |
| Hook the Horizon handoffs | `src/lib/handoff.ts` + `src/lib/fleet.ts` |
| Live official readings | `src/lib/live.server.ts`, `src/lib/live.functions.ts` |
| Field brief (screen and PDF) | `src/routes/packet.$id.tsx`, `src/lib/packet-pdf.ts` |

### House rules for the UI

- **One appearance control.** Light, dark, colour-blind-safe, high-contrast and
  motion live in `src/components/display-control.tsx`, mounted once by the root
  shell as the floating control in the lower-right corner. Do not add a second
  theme, contrast, motion or language switch anywhere.
- **No translation layer.** The interface is English. Waterbody names and
  agency notices are reproduced in their published wording, never restated.
- **Craft is labelled as craft.** Anything not read from an official source —
  the water-reading layer in particular — says so where it is shown.

## Live data

Scheduled ingest lives in GitHub Actions (`.github/workflows/ingest-live.yml`
and `ingest-critical.yml`) and publishes `snapshot.json` + `status.json` to the
`live-snapshot` branch. Interior-west / override / NOAA CO-OPS gauges refresh
every 10 minutes; the full catalog every 30. USBR is isolated so a RISE timeout
cannot stall USGS or NOAA. The last 24 hourly snapshots are kept under
`archive/`. Observation time, not ingest time, decides whether a value is
current (48 h stage/flow/weather, 7 d reservoir elevation). Fossils stay
retained with the original `observedAt`. The app consumes that snapshot
fail-closed: a silent or unbound gauge is reported as silent, never replaced
with a nearby station.

## Development

Requires Node.js 20+ and [Bun](https://bun.sh) (production installs and builds
on Vercel with `bun install` / `bun run build`).

```sh
bun install
bun run dev        # http://localhost:8080
bun run typecheck
bun run lint
bun run build      # applies the overlay, asserts the catalog, then builds
bun run test       # node:test over scripts/
```

The build asserts the catalog before bundling: it rejects empty or placeholder
JSON and requires at least 500 `HHI-DEST-*` records. That assertion lives inside
the `build` script on purpose — Bun skips npm-style `prebuild`.
