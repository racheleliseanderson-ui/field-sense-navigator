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

## Enrichment

Follow `docs/enrichment-2026-08-19.md`. Apply source-backed field updates only. Leave REVIEW OVERDUE banners in place until `nextReviewAt` is in the future. One jurisdiction (or one official-source family) per PR. Do not mix overlay/build fixes with lake seeds.

## Build

The Vite plugin assembly lives in `vite.base.config.ts` in this repository — Tailwind, tsconfig paths, TanStack Start, Nitro, React, `VITE_*` inlining and the `@` alias. `vite.config.ts` carries only this project's options (the `src/server.ts` SSR entry and the pinned `vercel` Nitro preset). There is no third-party build service in the pipeline. Change either file only alongside a verified `npm run build` on Vercel.

```sh
npm i
npm run dev
npm run build
```
