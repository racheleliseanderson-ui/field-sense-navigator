# Field Sense Navigator

Production is **Vercel-only**. Canonical public URL: https://waterways.hookthehorizon.blog

This repository is the source of truth. Do **not** treat a hosted editor as a second origin.

This is a **public-waters field catalog with fail-closed packets**. It is not a CMS, GIS, catch log, social map, or crowdsourced spots app. Expansion is more Destination records and tighter review — not a different product type.

## Hosting

- Live site: Vercel (`server: Vercel` on the public domain)
- Cron (GitHub Actions, published to the `live-snapshot` branch):
  - Critical gauges (interior-west + overrides + NOAA CO-OPS): every 10 minutes (`ingest-critical.yml`)
  - Full catalog: :02 and :32 (`ingest-live.yml`); USBR RISE/Hydromet is a follow-on isolated job
  - Closures: nightly (`scan-closures.yml`)
- `live-snapshot` keeps regular commits plus 24 hourly `archive/` copies — do not orphan-force-push it
- Vercel must **not** deploy `live-snapshot` as the app (`git.deploymentEnabled.live-snapshot: false` in `vercel.json`)
- Optional secrets: `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` (failure notify; GitHub issue is always-on)
- Do not force-push or rewrite published git history unless you have an explicit recovery plan

## Doctrine

Public waters only. Fail closed. Accuracy outranks completeness. No private spots, no coordinates, no catch guarantees, no invented gauge or hatch data. Observation time, not ingest time, decides whether a value is current (48 h stage/flow/weather, 7 d reservoir elevation). Fossils stay retained with the original observedAt.

Keep the records that have operational issues (low water, ramp closures, fire restrictions). Document the constraint. Do not delete named public waters because a season is hard.

## Architecture — three planes, one product

| Plane | Source of truth | Cadence | Never |
| --- | --- | --- | --- |
| **Catalog** | `src/data/destinations.json` on `main` | Human PR. Official page actually read. Provenance only when a source was read. | Invent access, seasons, or private spots. Overlay-only "fixes" that never land in git. |
| **Bindings** | `station-bindings.json` + `station-overrides.json` | `resolve-stations.mjs` — override wins; name + water-type must align | Nearby-gauge substitution |
| **Live** | `live-snapshot` branch (`snapshot.json`, `status.json`, `closures.json`, `archive/`) | 10 min critical / 30 min full / nightly closures | Write Destination records. Deploy this branch as the app. |
| **Replica** | Postgres, GENERATED from the catalog | `publish-catalog.yml` on merge to `main` | Be authoritative. Be edited by hand. Be required for the app to render. |

## The Postgres replica

`ww_*` tables in the Hook the Horizon Supabase project hold a generated copy of
the catalog. This is the sanctioned answer to "the JSON is getting big" — it is
**not** the exception to "never a database as catalog SoT", because nothing
writes it but CI and nothing reads back from it into the repository.

- Generator: `scripts/publish-catalog.ts`, run by **bun** so it imports
  `catalog.ts`, `intelligence.ts`, `access.ts` and `water-reading.ts` directly.
  The derived columns (readiness, hazard families, access kinds, logistics) are
  produced by the application's own engine. Never reimplement that scoring in
  SQL or in a `.mjs` — a second implementation drifts within a month.
- Every publish stamps a row in `ww_catalog_versions` with the commit sha and
  marks it current; rows carrying an older `version_id` are pruned, which is how
  a record removed from the catalog leaves the replica.
- Reads are anonymous and read-only (`ww_search`, `ww_facets`, RLS `using
  (published)`). There is no sign-in and no per-user row in any `ww_` table.
- `ww_search_gaps` is anonymous, write-only telemetry: no owner column, no
  select policy, a length cap and CHECK constraints that reject anything
  containing `@` or a long digit run. `ww_search_gaps_ranked` is the enrichment
  queue — what the catalog was asked for and could not answer.
- Bench views (`ww_needs_agency`, `ww_review_overdue`, `ww_unbound_gauges`,
  `ww_jurisdiction_coverage`, `ww_source_health`) are `security_invoker` and
  granted to nobody but the service role. Use them instead of writing another
  script in `scripts/`.
- **The read path is text ranking only.** `/explore` asks the replica *which
  records match these words, best first* (`ww_match_ids`) and does everything
  else itself — every facet, sort, page and the watchlist stay on the device.
  That is deliberate: an unreachable replica may cost ranking quality, but it
  must never change which records a filter returns. Do not move a filter into
  the replica without moving its fallback too.
- Reader: `catalog.server.ts` (server-only, key never reaches the client) behind
  the `matchCatalog` server function. It returns `null` — never throws — for
  missing config, timeout (2.5 s), HTTP error, malformed body, or `ready:false`.
  The route treats `null` as "keep what this device already computed".
- **Fail closed:** the application must render from the bundled catalog when the
  replica is stale, unconfigured or unreachable. Never make a page depend on it.
  Verified: with the replica hung, results are on screen in ~0.6 s and no late
  swap occurs when the request is abandoned.
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Without them the
  workflow skips with a notice rather than failing — the app does not need it.

The app (`src/lib/catalog.ts`) imports the catalog as one in-memory array. `NAMED_WATER_COUNT` is `destinations.length` — do not hardcode it. Search, packets, pipeline, and watchlist all read that array. Live readings are joined at request time via bindings + observation-age (`src/lib/observation-age.ts`).

Schema: `SCHEMA_VERSION` 0.6.0 in `src/lib/catalog.ts` (optional provenance fields). Do not add required fields that stale existing records.

**Build:** bun skips npm-style `prebuild`. Overlay apply + `assert-catalog.mjs` **must** live inside the `"build"` script. Assert rejects empty/placeholder JSON and requires ≥500 `HHI-DEST-*` records.

**Scale (same app, later):**

- Now (~500–2k waters, ~1.5 MB JSON): single file is fine for the client; GitHub already struggles to *render* the file.
- After enrichment PRs are on `main`: shard by jurisdiction under `src/data/destinations/` and concatenate in `catalog.ts`. Same schema, same UI.
- Around 2–3k waters: compact search index (id, name, state, tags); full record on the packet page.
- Never: database or CMS as catalog SoT; ingest writing `destinations.json`; a hosted editor as origin.

## Catalog

- Data: `src/data/destinations.json` (count = `NAMED_WATER_COUNT`)
- Schema and jurisdictions: `src/lib/catalog.ts` (also the single source for
  postal codes and per-jurisdiction counts — do not redeclare them)
- Documented intelligence (five layers, readiness, job ranking, checklists):
  `src/lib/intelligence.ts`
- Station bindings: `scripts/resolve-stations.mjs`

## Reading layers — what may claim what

Three layers reach the reader, and they must never be blurred together.

| Layer | Module | Claims |
| --- | --- | --- |
| **Documented** | `intelligence.ts` | Only what an agency published, with confidence and residual unknowns. Five layers — that number is a contract; a sixth scored layer is not the way to add anything. |
| **Access** | `access.ts` | Only the named facilities, published status and the agency's own amenity wording. A missing amenity is reported as unpublished, never as absent. |
| **Craft** | `water-reading.ts` | Standing water-reading for the CLASS of water, ordered by what the record documents. Never an observation of this water today, never a spot. Every surface that shows it must say so. |

`water-reading.ts` also carries the beginner → competent → advanced setting
(`ReadLevel`, held per device by `read-level.ts`). It is one setting shared by
every record, not a separate product tier.

## Fleet handoffs

`src/lib/fleet.ts` is the byte-identical fleet registry — the only place
cross-app URLs are enumerated. `src/lib/handoff.ts` builds the
Water → Species → Forage/Hatch → Presentation → Rig/Tackle → Knot → Field Ops
chain from it and encodes the `HTH-FLEET-1.0` packet. Rules: the packet travels
in the URL fragment (never sent to a server), nothing is posted automatically,
and the packet carries no coordinates and no private water. Add fields to the
packet; do not repurpose existing ones — other instruments read them.

## UI house rules

- **One appearance control.** `src/components/display-control.tsx` is mounted
  once by the root shell as the floating control in the lower-right corner and
  covers light, dark, colour-blind-safe, high-contrast and motion. No second
  theme, contrast, motion or language switch anywhere in the app. A page that
  fixes its own bar to the bottom of the viewport renders `<DockOffset />` so
  the control lifts clear of it.
- **No translation layer.** The interface is English; agency wording is
  reproduced, never restated. Do not reintroduce an i18n dictionary.
- **No pin map.** Geography is given as jurisdiction and neighbourhood
  (`coverage-map.tsx`, `nearby.ts`) because this instrument publishes no
  coordinates.
- **shadcn is not the design system.** Only `ui/command` and `ui/dialog`
  survive, for the jump palette. Build new UI from the instrument utilities in
  `styles.css`, not from scaffold components.

## Catalog growth and refresh pipeline

`scripts/pipeline/` writes the Catalog plane only, by hand-triggered run, from
an official page actually read. Launchers: `RUN-SEEDING.bat`, `RUN-REFRESH.bat`,
`HEALTH-CHECK.bat`. Full description in `docs/waterways-pipeline.md`.

- Discovery reads agency **sitemaps** and derives both the path families to look
  in and the jurisdiction from the catalog itself. A family spanning states
  yields nothing rather than a guessed jurisdiction.
- Six gates decide whether a candidate becomes a record: robots, page loads,
  trusted host (government or named public authority), page names the water,
  page reads as fishing this water, water class declared by its own published
  name. A failure is a drop with a reason in `reports/`, never a weaker record.
- Extraction reads the page's `<main>` region, not site navigation, and strips
  banners that appear across a run.
- Seeded records carry `lastHumanReviewedAt: null` and a 30-day `nextReviewAt`.
  Do not backfill those to look reviewed.
- Refresh is additive; it never deletes human wording it failed to find, never
  retires a water over a dead link, and moves dates only for pages it read.
  Shard records are written back to their shard.
- `agencies.mjs` learns host → agency from the catalog. Do not duplicate the map
  in `scripts/enrich-catalog.mjs`; a second implementation drifts.

## Enrichment

Follow `docs/enrichment-2026-08-19.md`. Apply source-backed field updates only. Leave REVIEW OVERDUE banners in place until `nextReviewAt` is in the future. One jurisdiction (or one official-source family) per PR. Do not mix overlay/build fixes with lake seeds.

## Build

The Vite plugin assembly lives in `vite.base.config.ts` in this repository — Tailwind, tsconfig paths, TanStack Start, Nitro, React, `VITE_*` inlining, build identity and the `@` alias. `vite.config.ts` carries only this project's options (the `src/server.ts` SSR entry and the pinned `vercel` Nitro preset). There is no third-party build service in the pipeline. Change either file only alongside a verified `npm run build` on Vercel.

```sh
npm i
npm run dev
npm run build
npm run verify   # typecheck, lint, tests, build, emitted-build invariants
```

## The gates

`.github/workflows/ci.yml` runs the whole of `npm run verify` plus a browser
smoke test on every push and pull request. Before it existed, five workflows
guarded the data plane and nothing at all guarded the code: `npm run lint` had
been failing on 430 errors with nobody to tell, `tsc` appeared in no script, and
production was the first environment in which the built application was ever
run. Keep it green; it is the only thing standing between a bad merge and the
public domain.

| Gate | What it catches |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`. The strict flags in `tsconfig.json` are load-bearing — `noUncheckedIndexedAccess` is what found the nullable `region` that took out search. |
| `npm run lint` | eslint, prettier-as-a-rule. Zero errors is the standard; the react-refresh warnings are accepted. |
| `prettier --check .` | `.prettierignore` excludes `src/data/**` and `**/*.md` for cause — see the comments in that file before adding anything back. |
| `bun test src` | The engines: catalog shape, intelligence, access, water-reading, handoff parity, the packet codec. |
| `node --test scripts/**/*.test.mjs` | The pipeline and ingest libraries. |
| `assert-catalog.mjs` | The catalog going in. |
| `assert-build-output.mjs` | The build coming out: Build Output API v3, Nitro preset `vercel`, a Node server function, a stamped service worker, the installable surface, and a client-payload ceiling. |
| `scripts/smoke.mjs` | Every route rendered in a real browser at a phone viewport — no uncaught error, no console error, no failed same-origin request, a title and an `h1` on each — then `/api/health`, `/api/version`, axe-core on the three densest surfaces, and the offline path with the radio cut. |

## The lockfile Vercel actually uses

`vercel.json` installs with **bun**, so `bun.lock` is what pins production and
it is committed. It was not, which meant every Vercel deploy re-resolved the
semver ranges in `package.json` from scratch: a patch release of any of ninety
dependencies could change the live site with no commit behind it, and no way to
tell afterwards which tree had been built. `package-lock.json` stays for the
`npm i` path in this file, but it is not the one that ships — if the two drift,
`bun.lock` is what is running.

## Build identity

Every build stamps its commit into the bundle (`vite.base.config.ts` →
`src/lib/build-info.ts`) and into the emitted service worker
(`scripts/stamp-sw.mjs`). `scripts/build-id.mjs` is the one place the id is
derived, because those two run in different processes and have to agree.

- `/api/health` — `application/json`, 200 healthy / 503 degraded, `no-store`.
  This is what an uptime probe should watch. `/health` is the same report as a
  page for a person.
- `/api/version` — commit, branch, build time, environment, schema version,
  record count. The first question in any production investigation.

**The service worker must be stamped.** `public/sw.js` carries a literal
`__BUILD_ID__` and the build replaces it. It used to carry a constant
`"fsn-v1"`, which meant the file was byte-identical on every deploy, so the
browser never saw a new worker, `install` never ran again after a reader's
first visit, and the offline shell stayed frozen at whatever the catalogue was
that day. Online it looked fine. At a ramp with no signal it was months old.
`assert-build-output.mjs` fails the build if the token survives.

## Security headers

`vercel.json` sets CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy` and HSTS on every response. The CSP allows no
external script host at all; `script-src` keeps `'unsafe-inline'` only because
the theme and field-mode boot scripts and TanStack Start's hydration payload
are inline. `geolocation=()` is doctrine as much as hardening — this instrument
publishes no coordinates and asks for no location. Adding a third-party
embed, font host or analytics script means changing this header deliberately,
which is the point.
