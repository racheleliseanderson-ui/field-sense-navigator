> **Historical record.** This is the prototype-era handoff written before the
> application was published. It is kept for provenance only: the app is now live
> at <https://waterways.hookthehorizon.blog>, the runtime and workflows referred
> to below as "reject" or "rewrite" are the ones in production, and the frozen
> commit named here is long superseded. Nothing in this file is current
> guidance — `AGENTS.project.md` and `README.md` are.

# Handoff Record — Field Sense Navigator (Honey Hole Intelligence)

Frozen commit: f86999a ("Deduped quick tap requests")
Working tree: clean. `tsgo --noEmit`: clean. Production build: green (client + SSR + worker).
Status: bounded prototype, non-canonical. Not published, no domain, no auth, no payments, no live credentials.

## Scope of this build
Public-waters-only, fail-closed field intelligence instrument. No private spots, no coordinates,
no catch guarantees, no invented gauge or hatch data.

## Selected behavior — classification

RETAIN (accepted, port as-is)
- src/lib/intelligence.ts — five-layer engine (access, hazards, crowding, regulation, field-check),
  Field Readiness Score with explicit "cannot know" list, job-aware ranking.
- src/lib/catalog.ts — 494-water catalog contract, jurisdiction helpers (state / province).
- src/lib/search.ts — fuzzy search, state/province abbreviations, species and verification-age facets.
- src/lib/live.server.ts + src/lib/live.functions.ts — USGS / NOAA CO-OPS / WSC / NWS reads,
  fail-closed on unbound or silent gauges.
- src/lib/queued-clicks.ts + src/components/live-conditions.tsx — pre-hydration tap capture,
  "Queued — loading official readings…" state, single-flight dedupe.
- src/lib/bindings.ts, src/data/station-overrides.json, src/data/location-overrides.json.
- src/lib/packet-pdf.ts — vector field-packet export.
- scripts/ingest-live.mjs, resolve-stations.mjs, resolve-locations.mjs, scan-closures.mjs.
- Routes: index, explore, water.$id, packet.$id, compare, plan, watchlist, boundary, pipeline.
- Visual system: dark/daylight themes, high-contrast and colour-blind modes, motion hooks,
  EN/ES shell — art direction is part of the accepted result, not incidental styling.

VERIFY before canonical merge
- Catalog source URLs: 39 records repointed after audit; agency hosts that return 403/429 to
  automated checks (e.g. Quebec ministry) must be re-read by a human, not trusted from the probe.
- Closure-scan snippets: language extraction is heuristic; confirm wording per jurisdiction.
- Canadian bindings: many provincial waters have no WSC gauge and correctly stay unbound.

REWRITE for the canonical target
- .github/workflows/* — ingest, resolve, closure-scan cadences and the live-snapshot branch
  publishing are generated here; re-author against canonical CI conventions and secrets.
- vercel.json and any host-specific config.

REJECT (do not merge)
- The React/TanStack runtime itself, scaffold, lockfile, components.json, shadcn defaults,
  demo routes, and any generated deployment workflow — canonical architecture governs.

## Port map (minimal, into an existing canonical branch)
| Source | Canonical destination | Note |
|---|---|---|
| src/lib/intelligence.ts | canonical scoring module | pure logic, no runtime deps |
| src/lib/catalog.ts + src/data/destinations.json | canonical data layer | data is the asset |
| src/lib/live.server.ts, live.functions.ts | canonical server layer | rewrite the RPC wrapper to canonical transport |
| src/lib/search.ts, bindings.ts, packet-pdf.ts | canonical lib | jspdf is the only new dependency |
| scripts/*.mjs | canonical scripts/ | keep as Node scripts |
| routes/* | WordPress templates | requires a per-pattern WordPress port map before publication |
| styles.css tokens, type scale, image plan | canonical theme | tokens transfer, Tailwind config does not |

## Dependencies added beyond scaffold
jspdf (field packet export). Nothing else.

## Known limits
- Live reads depend on a snapshot published to the `live-snapshot` branch; when stale the console
  says so rather than falling back to a nearby station.
- Critical gauges overlay every 10 minutes; full catalog at :02/:32; USBR is a follow-on job.
  Hourly copies live in `archive/` (24 retained). `status.json` drives the pipeline pulse and
  optional Slack/Discord + GitHub-issue notify on hard failure.
- Ambiguous multi-match stations stay unmatched by design and must be pinned by hand.
- Readings panel needs hydration; pre-hydration taps are queued and replayed.

## Rollback
Revert to commit f86999a. No database, no external state, nothing to unwind.

## Not performed here (requires separate explicit authorization)
Publication, domain connection, canonical main merge, WordPress staging, Supabase/auth/analytics/payments.
