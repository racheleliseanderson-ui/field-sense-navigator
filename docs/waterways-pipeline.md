# Growing and maintaining the catalog

Two double-click launchers and one read-only check, sitting on six small Node
scripts in `scripts/pipeline/`. Nothing here is a new plane in the
architecture: seeding and refresh both write the **Catalog** plane
(`src/data/destinations.json` and its shards), by hand-triggered run, from an
official page that was actually read. Ingest, bindings and the replica are
untouched.

| Launcher | What it does | How long |
| --- | --- | --- |
| `RUN-SEEDING.bat` | Find named waters the catalog does not have, prove them, add them | ~1 min per 15 waters |
| `RUN-REFRESH.bat` | Re-read every record's agency page and bring it up to date | ~1 hour for the catalog |
| `HEALTH-CHECK.bat` | Report age, duplicates, coverage and weak sources. Changes nothing | ~1 second |

## The scripts

```
scripts/pipeline/
  lib.mjs                shared: fetch, robots.txt, trust tiers, name matching
  agencies.mjs           host -> agency, LEARNED from the catalog, not declared
  extract.mjs            read a page: name, class, access, notices, species
  discover.mjs           what waters do the agencies publish that we lack?
  resolve-targets.mjs    prove each one, or drop it and say why
  seed-destinations.mjs  assign ids and append. The only writer of new records
  refresh.mjs            re-read what we already hold
  health.mjs             read-only report
  repair-seeded.mjs      fix or remove machine-seeded records after a gate change
  catalog-count.mjs      one number, for the launchers
  pipeline.test.mjs      the gates, under test
```

npm equivalents: `waters:discover`, `waters:resolve`, `waters:seed`,
`waters:refresh`, `waters:health`, `waters:count`, `test:pipeline`.

## How discovery works

Agency index pages are drawn by JavaScript, so fetching one returns navigation
and no lakes. Sitemaps do not have that problem — they are published so a
machine can enumerate a site, they are declared in `robots.txt`, and they are
complete.

The search is shaped by the catalog rather than by a list of URLs in this repo:

1. **Which hosts to ask** — the hosts existing records already cite.
2. **Where waters live on them** — the path *family* those records sit in
   (`/fishing/locations/lowland-lakes/`, `/fishboat/fish/recreational/lakes/`).
3. **Which jurisdiction** — the state those records agree on, and only when
   they agree at 80% or better. A family spanning states (nps.gov, blm.gov,
   fs.usda.gov) yields nothing, because a guessed jurisdiction is a wrong
   record.

So when an agency publishes a new lake page in a folder the catalog already
knows, discovery finds it, and nobody maintains a URL list. Hand-added starting
points go in `scripts/data/discovery-sources.json`.

Three ways of enumerating a host, in order:

1. **Sitemap** — the method. Complete, declared in `robots.txt`, no JavaScript.
2. **Index page** — for the roughly one host in three that publishes no
   sitemap (Montana, Idaho, Michigan, Maine, Kentucky, Maryland). The family
   folder is fetched and its links one level down are taken. Finds less, misses
   anything drawn by JavaScript.
3. **Wide scan** — when a host's own folders taught us nothing. Several
   agencies are cited in this catalog only by a section index
   (`/things-to-do/freshwater-fishing`), never by a page about one water, so
   there is no folder to learn from however large the sitemap is. For a host
   serving exactly one state, each URL is then judged on its own slug instead
   of the folder above it, with news, permit, grant and regulation sections
   excluded. Looser on purpose, and safe because it changes only what gets
   *asked* — the six gates still decide what gets written. `--no-wide` disables it.

A discovered name is a **question**, written to `scripts/data/seed-targets.json`.
Nothing in discovery writes `src/data`.

## The six gates

`resolve-targets.mjs` refuses a target unless all six pass:

1. `robots.txt` allows the fetch
2. the page loads and is not a soft 404
3. the host is government or a named public authority
4. the page **names** the water
5. the page reads like a page about fishing this water
6. the water's class (lake / river / reservoir / marine) is declared by its own
   published name

Then, and only then, fields are read — from the page's `<main>` region, not the
site menu, because an agency's global navigation says "Public fishing piers" on
every page it serves and would otherwise give every creek in the state a pier.

A target that fails any gate is **dropped with its reason**, never downgraded
into a weaker record. The reasons are in the newest `reports/resolve-targets-*`
file, and they are worth reading: `page_does_not_name_the_water` on a URL you
expected to work usually means the agency moved it.

## What a seeded record claims

- `waterbody` is the **water**, not a park on it. "Caddo Lake State Park" is
  filed as Caddo Lake; "Banks Lake Wildlife Area Unit" is filed as Banks Lake,
  which is how it stays one record instead of two.
- `publicAccess`, `currentNotices` and `speciesContext` carry only what the page
  said, in the page's wording. An access kind the page never mentions is
  **absent**, which per doctrine reads as unpublished, never as "no ramp here".
- Site-wide banners are stripped. A sentence carried by 40% of the pages one
  agency served in a run is template, not a notice about this water.
- `managingAgency` and `officialRegsUrl` come from `agencies.mjs`, which learns
  host → agency from records a human already reviewed. A host with no clear
  majority yields `null` rather than a guess.
- `lastHumanReviewedAt` and `lastHumanReviewedBy` are **null**, and
  `nextReviewAt` is 30 days out. These records are machine-verified and not
  human-read, and saying otherwise would put a false provenance in the catalog.

## What refresh will and will not do

- **Additive by default.** It adds wording the page now carries. It does not
  delete wording it merely failed to find, because "I could not find it" and
  "it is gone" are different claims. `--prune-notices` opts into removal.
- **A dead link is not a dead water.** A record whose page 404s keeps every
  field and every date it had, and is listed for a person. Retiring a named
  public water because a state redesigned its site is the failure this catalog
  exists to avoid.
- **Dates follow evidence.** `lastVerified` and the reviewed dates move only for
  records whose page was actually read and still names the water. A record that
  failed today keeps yesterday's dates and stays visibly stale.
- Records living in a shard are written back to that shard, not collapsed into
  the base file.

## Useful flags

```sh
node scripts/pipeline/discover.mjs --state=Montana --limit=40
node scripts/pipeline/discover.mjs --host=tpwd.texas.gov --dry
node scripts/pipeline/resolve-targets.mjs --state=Texas --limit=25 --dry
node scripts/pipeline/refresh.mjs --state=Washington --batch=40
node scripts/pipeline/refresh.mjs --all --prune-notices
node scripts/pipeline/health.mjs --links --batch=120
```

`--dry` on any of them does the work and writes the report without touching
`src/data`.

## Reports

Every run writes `reports/<name>-<timestamp>.md` and appends a line to
`reports/pipeline-runs.jsonl`. The reports are the record of what was refused
and why, which is the part of a fail-closed pipeline worth keeping.

## Repairing a bad run

`repair-seeded.mjs --from-id=<n>` re-checks machine-seeded records against the
current gates: it strips management designations from names ("Dowdy Lake SWA"
-> "Dowdy Lake"), removes records whose jurisdiction was never evidenced, and
removes names that turned out to be a document, a road, a building or a
headline. Scope is limited to ids at or above `--from-id`, so human-written
records can never be touched. Run it with `--dry` first.

Seeded records carry `seededBy: "field-sense-pipeline"` and `seededAt`, which
is how you find them all without id arithmetic.
