# Field Sense Navigator

Production is **Vercel-only**. Canonical public URL: https://waterways.hookthehorizon.blog

This repository is the source of truth. Do **not** treat Lovable as a second origin.

## Hosting

- Live site: Vercel (`server: Vercel` on the public domain)
- Cron (GitHub Actions, published to the `live-snapshot` branch):
  - Critical gauges (interior-west + overrides + NOAA CO-OPS): every 10 minutes (`ingest-critical.yml`)
  - Full catalog: :02 and :32 (`ingest-live.yml`); USBR RISE/Hydromet is a follow-on isolated job
  - Closures: nightly (`scan-closures.yml`)
- `live-snapshot` keeps regular commits plus 24 hourly `archive/` copies — do not orphan-force-push it
- Optional secrets: `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` (failure notify; GitHub issue is always-on)
- Do not force-push or rewrite published git history unless you have an explicit recovery plan

## Doctrine

Public waters only. Fail closed. Accuracy outranks completeness. No private spots, no coordinates, no catch guarantees, no invented gauge or hatch data.

Keep the records that have operational issues (low water, ramp closures, fire restrictions). Document the constraint. Do not delete named public waters because a season is hard.

## Catalog

- Data: `src/data/destinations.json` (518 named waters)
- Schema: `src/lib/catalog.ts` (currently `SCHEMA_VERSION` 0.6.0, including optional provenance fields)
- Intelligence: `src/lib/intelligence.ts`
- Station bindings: `scripts/resolve-stations.mjs` — override wins; name + water-type must align; no nearby substitution

## Enrichment

Follow `ENRICHMENT-PASS-2026-08-19.md`. Apply source-backed field updates only. Leave REVIEW OVERDUE banners in place until `nextReviewAt` is in the future.

## Build

`@lovable.dev/vite-tanstack-config` remains a **Vite config helper**, not an editor connection. Do not remove it without a verified replacement `vite.config.ts` that still builds on Vercel.

```sh
npm i
npm run dev
npm run build
```
