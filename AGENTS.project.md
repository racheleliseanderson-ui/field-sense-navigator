# Field Sense Navigator

Production is **Vercel-only**. Canonical public URL: https://waterways.hookthehorizon.blog

This repository is the source of truth. Do **not** treat Lovable as a second origin.

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

The app (`src/lib/catalog.ts`) imports the catalog as one in-memory array. `NAMED_WATER_COUNT` is `destinations.length` — do not hardcode it. Search, packets, pipeline, and watchlist all read that array. Live readings are joined at request time via bindings + observation-age (`src/lib/observation-age.ts`).

Schema: `SCHEMA_VERSION` 0.6.0 in `src/lib/catalog.ts` (optional provenance fields). Do not add required fields that stale existing records.

**Build:** bun skips npm-style `prebuild`. Overlay apply + `assert-catalog.mjs` **must** live inside the `"build"` script. Assert rejects empty/placeholder JSON and requires ≥500 `HHI-DEST-*` records.

**Scale (same app, later):**

- Now (~500–2k waters, ~1.5 MB JSON): single file is fine for the client; GitHub already struggles to *render* the file.
- After enrichment PRs are on `main`: shard by jurisdiction under `src/data/destinations/` and concatenate in `catalog.ts`. Same schema, same UI.
- Around 2–3k waters: compact search index (id, name, state, tags); full record on the packet page.
- Never: database or CMS as catalog SoT; ingest writing `destinations.json`; Lovable as origin.

## Catalog

- Data: `src/data/destinations.json` (count = `NAMED_WATER_COUNT`)
- Schema: `src/lib/catalog.ts`
- Intelligence: `src/lib/intelligence.ts`
- Station bindings: `scripts/resolve-stations.mjs`

## Enrichment

Follow `ENRICHMENT-PASS-2026-08-19.md`. Apply source-backed field updates only. Leave REVIEW OVERDUE banners in place until `nextReviewAt` is in the future. One jurisdiction (or one official-source family) per PR. Do not mix overlay/build fixes with lake seeds.

## Build

`@lovable.dev/vite-tanstack-config` remains a **Vite config helper**, not an editor connection. Do not remove it without a verified replacement `vite.config.ts` that still builds on Vercel.

```sh
npm i
npm run dev
npm run build
```
