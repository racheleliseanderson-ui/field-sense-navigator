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
| Postgres read replica (generated) | `scripts/publish-catalog.ts` |
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

## The catalog replica

The catalog also publishes to Postgres as a **generated read replica** — server
side search across the whole corpus, faceted counts, and bench queries for
enrichment, without shipping the catalog to the browser to get them.

git stays the source of truth. `publish-catalog.yml` regenerates the replica on
merge to `main`; nothing reads back from it into the repository, and the
application renders from the bundled catalog whenever the replica is stale,
unconfigured or unreachable. Reads are anonymous and read-only — there is no
sign-in anywhere in this application.

```sh
bun run publish:catalog -- --dry-run              # derive and check, write nothing
bun run publish:catalog -- --emit-sql .tmp/sql    # offline: emit applyable SQL
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… bun run publish:catalog
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as repository secrets to turn
the workflow on. Without them it skips with a notice.

### Reading from it

`/explore` asks the replica to rank text queries and does everything else on the
device. Give the deployment two environment variables to switch that on:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the project's publishable (anon) key — reads only |

Leave them unset and search runs entirely on the device, which is the default
and is not an error state. The replica is asked only when there is text to
match, is never awaited before paint, is abandoned after 2.5 seconds, and is
ignored unless the database itself reports a current publish of at least 500
records. Filters, sorts and paging never leave the device, so results cannot
change shape depending on whether Postgres is reachable.

The workflow itself lives at `.github/workflows/publish-catalog.yml`. A staged
copy is kept at `docs/ci/publish-catalog.yml` for tooling that is not allowed to
write into `.github/workflows/` — if the two ever drift, the one under
`.github/` is the one that runs.

## Tests

`src/lib/__tests__` covers the derivation engine — the code that turns an
agency's prose into every badge, facet, readiness score and replica column.
It is table-driven, and the negative cases carry the weight: both bugs found
by hand in this layer were patterns that matched, not patterns that failed
to. `current` as an adjective must not raise a current-and-flow hazard, and a
place name like "Plese Flats" must not raise a tide.

The suite also fixes the packet contract — `reviewedAt` is the record's own
source check and never the moment the link was pressed, air temperature is
never substituted for water temperature, a carried-forward reading is always
labelled as carried — and the review schedule, which must stay spread rather
than collapsing back into a single cliff.

Scripts stay on `node --test`; the TypeScript modules use `bun test`, because
bun resolves the `@/*` path mapping natively.

`bun run test:a11y` audits every route in all five display modes at phone and
desktop width — 100 page views — and exits non-zero on any violation or any
horizontal overflow. It starts its own dev server and needs a Chromium
(`npx playwright install chromium`, or set `CHROMIUM_PATH`). Run it after any
change to the token layer: the contrast failures it guards came from
translucent surfaces compositing over whatever sat behind them, and the
high-contrast modes were once the worst offenders — white bottomed out at
1.78:1, on the setting a low-vision reader would deliberately choose.

## Errors and health

The data pipeline has always reported its own failures — a GitHub issue on every
degraded ingest, plus Discord or Slack when those webhooks are set. The
application serving that data reported nothing, so a reader could hit the error
page and no one would know.

Client-side breaks and SSR 500s now both reach `recordClientError` in
`src/lib/errors.server.ts`. Every report is logged with a `[client-error]`
prefix so a log drain can filter for it, and posted to a webhook when one is
configured:

| Variable | Value |
| --- | --- |
| `ERROR_WEBHOOK_URL` | a Discord or Slack incoming webhook. Optional — without it, reports are logged only. |

A report carries the route path, the message, the stack and a coarse viewport.
It never carries the query string — a search term is something the reader typed
— and there is no identifier, no cookie and no third-party script, so the
instrument still collects nothing about the person holding it. Identical
reports are sent once and a page view sends at most five, so a broken render
cannot become a flood.

`/health` is a local-only heartbeat for an uptime monitor: it renders from the
committed catalog and binding file, makes no network call, and answers in
milliseconds. Match on `"status": "ok"`. It is deliberately not a live-data
check — that question is answered in full on `/pipeline` — and it returns 200
even when degraded, because a health endpoint that 500s tells you less than one
that explains.

## Contacting agencies

Every request to USGS, NOAA CO-OPS, the National Weather Service, USBR, USACE,
CDEC and the Water Survey of Canada carries a User-Agent naming the instrument
and a contact. Agencies use it to reach whoever is generating the traffic, so
it points at a support page rather than a person's inbox — a private address
does not belong in a public repository or in a header sent to five agencies on
every request. Override with `AGENCY_CONTACT_URL`.

Attribution and licence for each source are on `/boundary`, along with the
limits of what this instrument is. The Water Survey of Canada is the one source
with a licence condition: its data is released under the Open Government
Licence – Canada, which requires attribution wherever it is used, and 59 of the
catalog's bindings are WSC. That attribution is in the site footer and on
`/boundary`; do not remove it.

## Development

Requires Node.js 20+ and [Bun](https://bun.sh) (production installs and builds
on Vercel with `bun install` / `bun run build`).

```sh
bun install
bun run dev        # http://localhost:8080
bun run typecheck
bun run lint
bun run build      # applies the overlay, asserts the catalog, then builds
bun run test       # node:test over scripts/, then bun:test over src/
bun run test:unit  # just the derivation-engine suite
bun run test:a11y  # axe over every route in all five display modes
```

The build asserts the catalog before bundling: it rejects empty or placeholder
JSON and requires at least 500 `HHI-DEST-*` records. That assertion lives inside
the `build` script on purpose — Bun skips npm-style `prebuild`.
