/**
 * Publish the catalog to its Postgres read replica.
 *
 * git is the source of truth. This script GENERATES the replica from
 * `src/data/destinations*.json` and never reads back from it — if the replica
 * and the repository disagree, the repository is right and the replica is
 * stale. Nothing here writes to the catalog files.
 *
 * It runs under bun on purpose: bun executes TypeScript and honours the
 * tsconfig `@/` paths, so the derived columns (readiness, hazard families,
 * access kinds, logistics) are produced by the same modules the application
 * uses. A second implementation of the scoring would drift within a month.
 *
 *   bun run scripts/publish-catalog.ts --dry-run
 *   bun run scripts/publish-catalog.ts --emit-sql .tmp/catalog.sql
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… bun run scripts/publish-catalog.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  SCHEMA_VERSION,
  datedWindows,
  destinations,
  displayName,
  jurisdictionOf,
  reviewOverdue,
  type Destination,
} from "@/lib/catalog";
import { readTags, readiness } from "@/lib/intelligence";
import { logisticsIdsFor, readAccess } from "@/lib/access";
import { readWater } from "@/lib/water-reading";

const BATCH = 100;

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const dryRun = has("--dry-run");
const sqlPath = valueOf("--emit-sql");
/**
 * Seed mode omits the long-form columns (notices, verifications, access sites,
 * related records, provenance) and does NOT mark its version current. It exists
 * so a replica can be stood up and its queries proven from a machine with no
 * route to the database, over a channel where 1.1 MB of agency prose is
 * expensive to move. None of the search, facet or bench queries read those
 * columns. The first real publish fills them and takes over as current.
 */
const seedOnly = has("--seed");

const day = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1]! : null;
};

/** One replica row, derived by the application's own engine. */
function row(d: Destination) {
  const r = readiness(d);
  const t = readTags(d);
  const a = readAccess(d);
  const read = readWater(d);

  return {
    id: d.id,
    waterbody: d.waterbody,
    access_site: d.accessSite ?? null,
    display_name: displayName(d),

    state: d.state,
    region: d.region,
    county: d.county ?? null,
    jurisdiction: jurisdictionOf(d),
    water_type: d.waterType,

    status: d.status,
    official_source_url: d.officialSourceUrl,
    official_regs_url: d.officialRegsUrl ?? null,
    managing_agency: d.managingAgency ?? null,
    checked_at: day(d.checkedAt)!,
    next_review_at: day(d.nextReviewAt)!,
    regs_reviewed_date: day(d.regsReviewedDate),
    access_reviewed_date: day(d.accessReviewedDate),
    last_verified: day(d.lastVerified),
    last_human_reviewed_at: day(d.lastHumanReviewedAt),
    last_human_reviewed_by: d.lastHumanReviewedBy ?? null,
    review_overdue: reviewOverdue(d),

    species_context: d.speciesContext,
    tags: d.tags ?? [],
    current_notices: d.currentNotices,
    direct_verification: d.directVerification,
    unresolved_questions: d.unresolvedQuestions ?? [],
    season_windows: d.seasonWindows ?? [],
    public_access: d.publicAccess,
    related: d.related ?? [],
    provenance_notes: d.provenanceNotes ?? null,
    confidence_notes: d.confidenceNotes ?? null,

    usgs_site_id: d.usgsSiteId ?? null,
    noaa_coops_station_id: d.noaaCoopsStationId ?? null,
    ndbc_buoy_id: d.ndbcBuoyId ?? null,

    readiness_score: r.score,
    readiness_band: r.band,
    readiness_grade: r.grade,
    hazard_tags: [...t.hazards].sort(),
    crowd_tags: [...t.crowd].sort(),
    seasonal_tags: [...t.seasonal].sort(),
    access_kinds: [...new Set(a.sites.flatMap((s) => s.kinds))].sort(),
    logistics: [...logisticsIdsFor(d)].sort(),
    named_sites: a.namedSites,
    dated_closures: datedWindows(d).length,
    has_open_launch: t.hasOpenLaunch,
    has_shore_access: t.hasShoreAccess,
    has_hand_launch: t.hasHandLaunch,
    directory_only: a.directoryOnly,
    water_class_headline: read.headline,
    published: true,
  };
}

type Row = ReturnType<typeof row>;

const COLUMNS: Array<[keyof Row, string]> = [
  ["id", "text"], ["waterbody", "text"], ["access_site", "text"], ["display_name", "text"],
  ["state", "text"], ["region", "text"], ["county", "text"], ["jurisdiction", "text"],
  ["water_type", "text"], ["status", "text"], ["official_source_url", "text"],
  ["official_regs_url", "text"], ["managing_agency", "text"], ["checked_at", "date"],
  ["next_review_at", "date"], ["regs_reviewed_date", "date"], ["access_reviewed_date", "date"],
  ["last_verified", "date"], ["last_human_reviewed_at", "date"], ["last_human_reviewed_by", "text"],
  ["review_overdue", "boolean"], ["species_context", "text[]"], ["tags", "text[]"],
  ["current_notices", "text[]"], ["direct_verification", "text[]"],
  ["unresolved_questions", "text[]"], ["season_windows", "jsonb"], ["public_access", "jsonb"],
  ["related", "jsonb"], ["provenance_notes", "text"], ["confidence_notes", "text"],
  ["usgs_site_id", "text"], ["noaa_coops_station_id", "text"], ["ndbc_buoy_id", "text"],
  ["readiness_score", "smallint"], ["readiness_band", "text"], ["readiness_grade", "text"],
  ["hazard_tags", "text[]"], ["crowd_tags", "text[]"], ["seasonal_tags", "text[]"],
  ["access_kinds", "text[]"], ["logistics", "text[]"], ["named_sites", "integer"],
  ["dated_closures", "integer"], ["has_open_launch", "boolean"], ["has_shore_access", "boolean"],
  ["has_hand_launch", "boolean"], ["directory_only", "boolean"],
  ["water_class_headline", "text"], ["published", "boolean"],
];

const commit = (() => {
  if (process.env["GITHUB_SHA"]) return process.env["GITHUB_SHA"];
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

const rows = destinations.map(row);

/* ---------------- offline path: emit SQL ---------------- */

const LONG_FORM: Array<keyof Row> = [
  "current_notices", "direct_verification", "public_access", "related",
  "unresolved_questions", "season_windows", "provenance_notes", "confidence_notes",
];

function emitSql(dir: string) {
  const cols = seedOnly
    ? COLUMNS.filter(([c]) => !LONG_FORM.includes(c))
    : COLUMNS;
  const colList = cols.map(([c]) => c).join(", ");
  const recordDef = cols.map(([c, t]) => `${c} ${t}`).join(", ");
  const updates = cols.filter(([c]) => c !== "id")
    .map(([c]) => `${c} = excluded.${c}`)
    .join(", ");
  const pick = (r: Row) => {
    if (!seedOnly) return r;
    const out: Record<string, unknown> = {};
    for (const [c] of cols) out[c] = r[c];
    return out;
  };

  // The version id is minted here rather than by the database so that every
  // emitted file is a self-contained transaction. A psql run applies them in
  // order; so does any client that can only send one statement at a time.
  const versionId = crypto.randomUUID();
  const size = Number(valueOf("--batch") ?? BATCH);
  const files: Array<[string, string]> = [];

  files.push([
    "000-version.sql",
    [
      "-- GENERATED by scripts/publish-catalog.ts. Do not edit.",
      `-- commit ${commit} · schema ${SCHEMA_VERSION} · ${rows.length} records`,
      "insert into public.ww_catalog_versions (id, commit_sha, schema_version, record_count, note)",
      `values ('${versionId}', '${commit}', '${SCHEMA_VERSION}', ${rows.length}, ${
        seedOnly
          ? "'verification seed — long-form columns empty; the first publish fills them'"
          : "null"
      })`,
      "on conflict (id) do nothing;",
    ].join("\n"),
  ]);

  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size).map(pick);
    files.push([
      `${String(files.length).padStart(3, "0")}-waters.sql`,
      [
        `insert into public.ww_waters (version_id, updated_at, ${colList})`,
        `select '${versionId}'::uuid, now(), ${cols.map(([c]) => `x.${c}`).join(", ")}`,
        `from jsonb_to_recordset($catalog$${JSON.stringify(batch)}$catalog$::jsonb)`,
        `  as x(${recordDef})`,
        `on conflict (id) do update set version_id = excluded.version_id, updated_at = now(), ${updates};`,
      ].join("\n"),
    ]);
  }

  files.push([
    `${String(files.length).padStart(3, "0")}-finalise.sql`,
    [
      "-- records that left the catalog in this commit",
      `delete from public.ww_waters where version_id is distinct from '${versionId}'::uuid;`,
      ...(seedOnly
        ? ["-- a seed is deliberately never marked current: it is not a published catalog."]
        : [
            "update public.ww_catalog_versions set is_current = false where is_current;",
            `update public.ww_catalog_versions set is_current = true where id = '${versionId}'::uuid;`,
          ]),
    ].join("\n"),
  ]);

  mkdirSync(dir, { recursive: true });
  for (const [name, body] of files) writeFileSync(`${dir}/${name}`, body + "\n", "utf8");
  console.log(`wrote ${files.length} files to ${dir} (${rows.length} records, commit ${commit.slice(0, 7)})`);
}

/* ---------------- online path: PostgREST ---------------- */

async function publish(url: string, key: string) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const rest = (path: string) => `${url.replace(/\/$/, "")}/rest/v1/${path}`;
  const check = async (res: Response, what: string) => {
    if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`);
    return res;
  };

  const versionRes = await check(
    await fetch(rest("ww_catalog_versions"), {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        commit_sha: commit,
        schema_version: SCHEMA_VERSION,
        record_count: rows.length,
      }),
    }),
    "create version",
  );
  const versionId = (await versionRes.json())[0].id as string;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      ...r,
      version_id: versionId,
      updated_at: new Date().toISOString(),
    }));
    await check(
      await fetch(rest("ww_waters"), {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch),
      }),
      `upsert ${i}-${i + batch.length}`,
    );
    console.log(`  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  // Anything still carrying an older version left the catalog in this commit.
  await check(
    await fetch(rest(`ww_waters?version_id=neq.${versionId}`), {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=minimal" },
    }),
    "prune removed records",
  );

  await check(
    await fetch(rest("ww_catalog_versions?is_current=is.true"), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ is_current: false }),
    }),
    "clear previous current",
  );
  await check(
    await fetch(rest(`ww_catalog_versions?id=eq.${versionId}`), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ is_current: true }),
    }),
    "mark current",
  );

  console.log(`published ${rows.length} records · commit ${commit.slice(0, 7)} · version ${versionId}`);
}

/* ---------------- run ---------------- */

const summary = {
  records: rows.length,
  jurisdictions: new Set(rows.map((r) => r.state)).size,
  overdue: rows.filter((r) => r.review_overdue).length,
  withoutAgency: rows.filter((r) => !r.managing_agency).length,
  unbound: rows.filter((r) => !r.usgs_site_id && !r.noaa_coops_station_id && !r.ndbc_buoy_id).length,
  meanReadiness: Math.round(rows.reduce((n, r) => n + r.readiness_score, 0) / rows.length),
};
console.log(`catalog ${SCHEMA_VERSION} @ ${commit.slice(0, 7)}:`, JSON.stringify(summary));

if (rows.length < 500) {
  console.error(`refusing to publish ${rows.length} records — the catalog assertion floor is 500.`);
  process.exit(1);
}

if (sqlPath) {
  emitSql(sqlPath);
} else if (dryRun) {
  console.log("dry run — nothing written.");
} else {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to publish.");
    process.exit(1);
  }
  await publish(url, key);
}
