# Forensic audit — Field Sense Navigator, 2026-09-05

Full crawl of the repository, the emitted build and the live deployment, with
the work that came out of it. Written to be read in six months by somebody who
has forgotten why any of this is here.

## Executive verdict

**This application is built correctly and it is not the thing that needs
rebuilding.** The framework is right, the runtime is right, the state model is
right, the data doctrine is unusually good, and the engines are inspectable and
tested. Nothing in this audit argued for a rewrite, a different framework, a
database as source of truth, or a different application boundary.

What was wrong was everything *around* the code. Five GitHub workflows guarded
the data plane — ingest, station resolution, closure scanning, catalog
replication — and **nothing whatsoever guarded the code plane**. `npm run lint`
had been failing on 430 errors with nobody to tell it. `tsc` appeared in no
script, so nothing ever ran it. The Vercel deploy resolved ninety dependencies
from scratch every time because the lockfile it uses was not committed. And
production was the first environment in which the built application had ever
been run.

One defect found in that gap is genuinely serious for this product, and it is
described in full below: **the offline shell was frozen at each reader's first
visit.**

The verdict on architecture, then: keep the bones, close the gate, and revisit
the client payload when the catalogue tells you to — not before.

## Current architecture

| Layer | What it is |
| --- | --- |
| Framework | TanStack Start 1.168 / Router 1.170, React 19.2, TypeScript 5.9 strict |
| Build | Vite 8 with the plugin assembly owned in `vite.base.config.ts`; no third-party build service |
| Server | Nitro 3 beta, `vercel` preset pinned, Build Output API v3, one `__server.func` on `nodejs22.x` with response streaming |
| Host | Vercel, `waterways.hookthehorizon.blog`, Pro plan |
| Styling | Tailwind v4 via `@tailwindcss/vite`, lightningcss transformer; shadcn deliberately reduced to `ui/command` and `ui/dialog` |
| Catalog plane | `src/data/destinations.json` on `main` — 1038 records, 63 jurisdictions, 2.3 MB, human PR |
| Bindings plane | `station-bindings.json` + overrides; 744 of 1033 waters bound to a gauge |
| Live plane | `live-snapshot` branch, 10-minute critical / 30-minute full / nightly closures, read server-side |
| Replica | Postgres `ww_*` in Supabase, GENERATED from the catalog, text ranking only, fail-closed |
| Client state | Local-first: watchlist, read level, compare tray, field mode, display control all on the device |
| Handoffs | `HTH-FLEET-1.0` packets in the URL fragment, never posted, no coordinates |
| PWA | Hand-written service worker, manifest with maskable icon and three shortcuts, six prefetched offline routes |
| Tests | 276 unit (bun) + 49 pipeline (node) — all passing before and after this work |

### Is the architecture correct?

Taking the questions in the mandate one at a time, on the evidence:

- **Right framework?** Yes. This is a mostly-static, mostly-local reading
  instrument with per-record SSR for share links and crawlers. TanStack Start
  is a good fit and is being used properly — file routes, typed search params
  validated with zod 4 `.catch()` (with a real comment explaining why the zod
  adapter was dropped), server functions for anything touching a key, CSRF
  middleware re-added explicitly after `src/start.ts` opted out of the default.
- **Nitro real or decorative?** Real. It drives the production build path and
  emits Build Output API v3 with the preset pinned in `vite.config.ts` so a
  build outside Vercel's CI can never silently emit a Cloudflare worker. That
  pin is now asserted rather than assumed.
- **`.vercel/output` committed?** No — correctly gitignored.
- **Right state model?** Yes, and this is the strongest judgement call in the
  application. Private working state is local; reference data is bundled; the
  Postgres replica is generated, anonymous, read-only, and used **for text
  ranking only**, with every facet, sort and page staying on the device. An
  unreachable replica costs ranking quality and cannot change which records a
  filter returns. That is the correct shape and it is documented as doctrine.
- **Should it be a PWA?** Yes, unambiguously — a field instrument used at a
  ramp with no signal. It is one, and the installable surface is complete. The
  update mechanism was broken; see below.
- **Should it absorb or split?** Neither. The fleet handoff chain (Water →
  Species → Forage → Presentation → Rig → Knot → Field Ops) crosses genuinely
  different jobs and the packet contract already carries context forward, so
  the reader does not re-enter what another instrument knows. Merging them
  would produce one large app with seven unrelated halves.

## What is genuinely excellent

Worth naming, because these should be the fleet's reference material:

1. **The doctrine in `AGENTS.project.md`.** Three planes with an explicit
   "Never" column per plane. Most repositories cannot say what they refuse to
   do. This one can, and the refusals are load-bearing.
2. **The layer separation in `intelligence.ts` / `access.ts` /
   `water-reading.ts`.** Documented, Access and Craft may each claim a
   different class of thing, and the modules are structured so they cannot
   blur. A missing amenity is reported as *unpublished*, never as *absent* —
   that distinction is the whole product.
3. **Fail-closed as an implemented behaviour, not a slogan.** The replica
   reader returns `null` and never throws, for missing config, timeout, HTTP
   error, malformed body or `ready:false`. Live readings gate on **observation**
   time, not ingest time. The service worker refuses to cache live data at all,
   with a comment saying why: a stale river level shown as current is the most
   dangerous thing this app could do.
4. **`scheduleReview`.** A deterministic FNV-1a hash of the record id spreads
   review dates so the catalogue does not all fall due on one morning, and
   `reviewScheduleNote()` exists specifically so no surface prints a precise
   date without saying what kind of date it is. That is a level of care about
   implied claims that most products never reach.
5. **The comments that record a fixed bug.** The nullable `region` typing, the
   zod-adapter removal, the h3 swallowed-error normalisation in `src/server.ts`.
   Each one explains a real failure so it cannot be reintroduced by someone
   tidying up.
6. **Art direction.** Two renditions per plate, a real `srcSet`/`sizes` ladder,
   `fetchPriority` on the first hero, intrinsic `width`/`height` on every image.
   Nothing to fix.
7. **The pipeline's six gates** and the fact that a failure is a drop with a
   reason in `reports/`, never a weaker record.

## What was weak, accidental, obsolete or broken

Ordered by how much it mattered.

### 1. The offline shell was frozen at each reader's first visit — SERIOUS

`public/sw.js` declared `const VERSION = "fsn-v1"`. Nothing in the build ever
changed it, so the file the browser downloaded was **byte-identical on every
deploy**. A browser only treats a service worker as new when its bytes differ,
so:

- `install` ran exactly once in a reader's lifetime, on their first visit, and
  never again. The six prefetched offline routes were whatever they looked like
  that day.
- `activate` deletes caches that do not match `VERSION`, and `VERSION` never
  moved, so nothing was ever discarded. The hashed-asset cache grew by a whole
  build every deploy and never shed one.

Online this was invisible, because navigations are network-first and always
current. Offline it was the product's central promise going quietly wrong: an
angler who installed the navigator in July and opened it at a ramp with no
signal in December was reading July's catalogue, with nothing on screen to say
so.

**Fixed.** `public/sw.js` now carries a `__BUILD_ID__` token that
`scripts/stamp-sw.mjs` replaces with the commit sha after every build, so a
deploy is what expires an offline shell. The two caches were also given the two
lifetimes they actually need: the shell cache is keyed on the build and a deploy
discards it; the hashed-asset cache is unversioned (a hashed URL is correct
forever, and re-keying it would make every deploy re-download the 1.9 MB
catalogue chunk over whatever signal the reader has) and is pruned by size
instead. `assert-build-output.mjs` fails the build if the token survives.

### 2. No CI on the code plane at all

Consequences that had already accumulated, none of which anything would have
reported:

- `npm run lint` exited with **430 errors** (all `prettier/prettier`, all in
  `scripts/**`).
- No `typecheck` script existed. `tsc` was never run by any command. It happens
  to pass, which is luck plus a careful author, not a guarantee.
- `bun.lock` was untracked. `vercel.json` installs with `bun install`, so
  **every production deploy re-resolved ninety dependencies from scratch** — a
  patch release anywhere in the tree could change the live site with no commit
  behind it, and no way afterwards to tell which tree had been built.
  `package-lock.json` was committed but is not what ships.
- `test:a11y` pointed at `scripts/a11y-audit.mjs`, deleted three commits
  earlier. The command was dead.

**Fixed.** `.github/workflows/ci.yml` runs typecheck, lint, prettier, unit
tests, pipeline tests, catalog invariants, the production build,
`assert-build-output.mjs`, and a browser smoke test, on every push and pull
request. It installs with bun because Vercel does — a CI that installs with a
different package manager is testing a tree the host will never build.
`bun.lock` is committed. `test:a11y` was removed and axe now runs in the smoke
test against the built app, which is strictly better.

### 3. `npm run format` would have rewritten the catalogue

`.prettierignore` did not exclude `src/data/**`. Running the repository's own
format command would have reformatted `src/data/destinations.json` — 2.3 MB in
one commit, burying whatever record actually changed and conflicting with every
open catalog PR.

Worse, prettier's markdown printer was actively **damaging** the documentation:
it re-pads every table cell to the widest one (so a one-word edit rewrites the
whole table) and it strips the two-space indent that continues a wrapped list
item, which breaks the list. It had already mangled a bullet in
`AGENTS.project.md`.

**Fixed.** `src/data/**`, `public/live/**`, `scripts/data/**`, `reports/**` and
`**/*.md` are ignored, each with a comment saying why.

### 4. Keyboard access to the wide drawings — WCAG 2.1 AA, serious

Found by running axe against the built water record page, which nothing had
done. `.hthp-plate__frame` (every field plate) and the plan-view schematic both
scroll horizontally on a phone and contain no tabbable element, so a
keyboard-only or switch-access reader could not reach the right-hand half of any
wide drawing. axe reports it as `scrollable-region-focusable`, impact
*serious*.

**Fixed.** Both containers are focusable and labelled, with a brass
`:focus-visible` ring rather than the browser's default on a ground it never
chose. axe is now clean on `/`, `/explore` and `/water/$id`.

### 5. Three dead fallbacks that read like a safety net

`live.server.ts` fell back to a relative `"/live/snapshot.json"` (and
`status`, `closures`) when the published branch was unreachable. Dead twice
over: Node's `fetch` cannot parse a relative URL, so the call always threw
before reaching the network — and the file shipped at that path was a 344-byte
stub with `sites: []` and a note saying "Trimmed snapshot created by Copilot to
repair JSON". `.gitignore` even said a committed copy "would be dead weight that
reads like a fallback"; the file predated the rule.

**Fixed.** Removed, with a comment explaining that a bundled copy could not be a
safety net anyway — the freshness gate is on observation time, so a committed
reading is stale the day it lands and would be rejected on arrival.

### 6. No security headers

`vercel.json` set one cache header and nothing else. No CSP, no `nosniff`, no
referrer policy, no permissions policy, no HSTS, no frame-ancestors.

**Fixed.** All added. The CSP allows **no external script host at all** — this
app loads no third-party script, which is a strong position to be able to
enforce. `script-src` keeps `'unsafe-inline'` only because the theme and
field-mode boot scripts and TanStack Start's hydration payload are inline;
moving to nonces would need Start-side support and is on the frontier list.
`geolocation=()` is doctrine as much as hardening — this instrument publishes no
coordinates and asks for no location.

### 7. Production could not name itself

No build stamp anywhere. A reader reporting that a water showed the wrong
wording could not be placed on the current deploy, a months-old service-worker
shell, or a preview URL somebody shared. `/health` existed but was an HTML page
wrapping a `<pre>`, so an uptime probe had to parse markup for a heartbeat.

**Fixed.** `/api/health` (`application/json`, 200 healthy / 503 degraded,
`no-store`) and `/api/version` (commit, branch, build time, environment, schema
version, record count). `/health` stays as the page a person opens and now links
to both.

### 8. Dead scaffolding

`field-sense-script-fix/` held byte-identical copies of two pipeline scripts and
all four `.bat` launchers already in the repository root, plus a README telling
the reader to `git pull` instead. Removed. It was also contributing 37 of the
430 lint errors.

### 9. The Vercel project is still flagged as a Lovable framework

Not fixed here, because it is a dashboard setting rather than a file. The
project's `framework` field reads **`tanstack-start-lovable`**. `vercel.json`
sets `"framework": null` and that is what governs the build, so nothing is
broken — but it is exactly the kind of no-code-builder tie you have asked to be
rid of across the fleet. Change it to **Other** in Vercel → Project → Settings →
Build and Deployment. Worth checking the other fleet projects for the same
field.

## Architecture decisions — what was kept, and why

The most important decision in this audit was to **keep the whole catalogue in
the client bundle**, and it is worth recording the reasoning because the numbers
look alarming in isolation.

The client ships `catalog-*.js` at **1.88 MB raw / ~203 KB gzipped**, plus
`bindings-*.js` at 542 KB / 84 KB gz, and the header (`chrome.tsx`) imports from
the catalog, so it is pulled on every route including the home page. On the
face of it that is the headline performance problem.

It is not a bug. It is the trade that makes the product work. Every water
record is readable at a ramp with no signal *because* the catalogue is on the
device; move it behind a server function and `/water/$id` stops working
offline, which is the one thing this instrument promises. The bytes are
downloaded once, on an immutable hashed URL, and held by the service worker.
Vite already emits the data as `JSON.parse("…")` rather than object literals, so
the parse is about as fast as it can be.

What was missing was a *decision point*. `assert-build-output.mjs` now prints
the client payload on every build and fails over a 6 MB ceiling, with the
failure message pointing at the "Scale (same app, later)" section of
`AGENTS.project.md` rather than at a number to raise. Growth is now something
somebody chooses.

Two smaller findings on the payload, both left for a data-plane pass:

- `privacy` is a **single distinct object across all 1038 records** —
  `{classification: "public_destination", publicLocationIncluded: true,
  sensitiveLocationIncluded: false}` — costing 104 KB in git and on the wire.
  Hoisting it to a default in `catalog.ts` and dropping it from the JSON is a
  clean win, but it touches the seeding scripts and `assert-catalog.mjs`, so it
  belongs in a catalog PR, not a build PR.
- `currentNotices` (251 KB) and `directVerification` (200 KB) are the two
  heaviest fields and are read by the intelligence engine and the water card,
  so they earn their place.

## Standardization — what this app should give the fleet, and take from it

**Give:**

- `scripts/build-id.mjs` + the `__BUILD_*` block in `vite.base.config.ts` +
  `src/lib/build-info.ts`. Zero dependencies, drop-in.
- `scripts/stamp-sw.mjs` and the stamped `public/sw.js`. **Every Hook app with
  a service worker has this same frozen-shell bug**, because the file says so
  itself: "FLEET PATTERN. Everything below the config block is identical in
  every Hook app that has one." Seven apps, one diff.
- `scripts/assert-build-output.mjs` — the preset check and the unstamped-worker
  check apply unchanged anywhere Nitro targets Vercel.
- `scripts/smoke.mjs` — the only app-specific parts are the route list and the
  offline assertion.
- `.github/workflows/ci.yml` — a good candidate for a GitHub **reusable
  workflow** rather than seven copies.
- The `vercel.json` header block.
- The `.prettierignore` reasoning, especially `**/*.md`.

**Take:** nothing found. This is one of the stronger applications in the fleet
and is more likely to be the source than the destination.

## Growth map

Ordered by value against effort. None of these were implemented; all of them
are grounded in something the audit actually measured.

1. **289 waters have no gauge binding** (744 matched of 1033). That is 28% of
   the catalogue where the live plane has nothing to say. `ww_unbound_gauges`
   already exists as a bench view. A "waters with no gauge" surface — or simply
   a documented queue — turns an invisible gap into a work list.
2. **`ww_search_gaps_ranked` is an enrichment queue nobody is reading.** It
   records what the catalogue was asked for and could not answer. That is the
   single best signal available for which water to seed next, and it is already
   being collected.
3. **A "what changed on this water" record.** The catalogue already carries
   `checkedAt`, `lastVerified`, `regsReviewedDate`, `accessReviewedDate` and the
   refresh pipeline is additive. A per-record change log — access site added, a
   notice appearing, a status moving — is nearly free from data already held,
   and it is the first thing that would make a reader come back rather than
   look once.
4. **The watchlist could earn a reason to return.** Today it is a list. If it
   said *what moved since you last looked* — a notice appearing, a review
   falling due, a closure scanned — it becomes the surface a reader opens on a
   Friday night.
5. **Uptime probing.** `/api/health` now exists and moves its status code;
   nothing watches it. A free external monitor closes the loop.
6. **Preview deployment verification.** The smoke test currently runs against a
   locally built tree. Pointing it at the Vercel preview URL before promotion
   would make production genuinely not the first environment the deployment
   runs in.
7. **Observability.** No Speed Insights, no Web Analytics, no structured server
   logging. The privacy model here is strict and correct, and any
   instrumentation must respect it — but route-level timings and error counts
   carry nothing about a reader.

## Verification

Everything below was run against this tree, in this session.

```
typecheck (tsc --noEmit)          clean
eslint .                          0 errors, 29 warnings (react-refresh, accepted)
prettier --check .                clean
bun test src                      276 pass / 0 fail, 9274 assertions
node --test scripts/**/*.test.mjs  49 pass / 0 fail
bun run build                     green
assert-build-output.mjs           Build Output API v3, Nitro preset=vercel,
                                  runtime nodejs22.x streaming, sw stamped,
                                  client js+css 4.15 MB
scripts/smoke.mjs                 11 routes + not-found, /api/health,
                                  /api/version, axe on 3 surfaces, offline
```

Smoke detail — Chromium at 390×844, mobile, touch, all off-origin requests
sealed:

- `/`, `/explore`, `/reading`, `/plan`, `/watchlist`, `/boundary`, `/compare`,
  `/pipeline`, `/health`, `/water/HHI-DEST-001`, `/packet/HHI-DEST-001` — all
  200, all with a title and an `h1`, no uncaught error, no console error, no
  failed same-origin request.
- `/water/HHI-DEST-does-not-exist` renders the not-found page. Nothing invented.
- `/api/health` → `status: "ok"`, 1038 records, 744 bindings matched.
- `/api/version` → build id, sha, environment, schema 0.6.0.
- axe (wcag2a/2aa/21a/21aa) on `/`, `/explore` and `/water/$id`: **no serious or
  critical violation**, 23 / 26 / 31 checks passing.
- Service worker activates, and `/reading` still renders **with the network
  cut**.

Stamping was proved both ways: a build with a different sha produces a different
`BUILD_ID` and a different shell cache key, and an unstamped worker fails
`assert-build-output.mjs` rather than shipping.

Production was probed live before the work: `/health` reported `status: "ok"`,
1038 records, 744 of 1033 bindings matched, 0 reviews overdue.

## Remaining frontier

Found and understood, deliberately not implemented:

- **CSP nonces.** `script-src` keeps `'unsafe-inline'` for the two boot scripts
  and Start's hydration payload. Nonces need framework-side support and would
  need verifying against streaming SSR.
- **Drop `privacy` from the catalog JSON** (104 KB) — a catalog PR, because it
  touches the seeding scripts and `assert-catalog.mjs`.
- **Two lockfiles.** `bun.lock` now ships and is authoritative; `package-lock`
  stays for the `npm i` path in the README. They will drift. Pick one.
- **No explicit focus styles anywhere** except the two added here. Browser
  defaults are visible on this ground, so it is not a violation — but a
  deliberate brass focus ring across the instrument would be better than
  relying on Chrome's judgement.
- **Preview-deployment smoke** rather than local-build smoke.
- **`vercel.json` sets no `functions` block** — memory, duration and region are
  all defaults. Fluid Compute and region alignment with the Supabase project are
  worth measuring; nothing in this audit showed they are currently hurting.
- **The frozen-shell fix has not been applied to the other six Hook apps.**
