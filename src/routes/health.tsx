import { createFileRoute } from "@tanstack/react-router";

import { NAMED_WATER_COUNT, SCHEMA_VERSION, destinations, reviewOverdue } from "@/lib/catalog";
import { bindingsFile } from "@/lib/bindings";
import { BUILD, BUILD_ID } from "@/lib/build-info";
import { withIdentity } from "@/lib/seo";

/**
 * A machine-checkable heartbeat for an uptime monitor.
 *
 * Deliberately local-only: it renders from the committed catalog and
 * binding file and makes no network call, so it answers in milliseconds
 * and cannot flap because an agency was slow. Live-plane freshness is a
 * different question and it is answered, in full, on /pipeline.
 *
 * A monitor should match on "status": "ok". Any of the invariants below
 * failing flips it to "degraded" — the page still returns, because a
 * health endpoint that 500s tells you less than one that explains.
 *
 * This is the page a PERSON opens. `/api/health` is the same report as
 * `application/json` with a moving HTTP status, and that is the one an uptime
 * probe should watch — parsing markup for a heartbeat is how a monitor ends up
 * reporting on the shape of a `<pre>` tag.
 */
export const Route = createFileRoute("/health")({
  head: () =>
    withIdentity(
      { path: "/health", noindex: true },
      { meta: [{ title: "Health · Field Sense Navigator" }] },
    ),
  component: Health,
});

const MIN_RECORDS = 500;
const MIN_MATCHED_BINDINGS = 400;

function Health() {
  const matched = bindingsFile.stats.matched;
  const overdue = destinations.filter((d) => reviewOverdue(d)).length;

  const checks = {
    catalog_loaded: NAMED_WATER_COUNT >= MIN_RECORDS,
    bindings_loaded: matched >= MIN_MATCHED_BINDINGS,
    review_queue_bounded: overdue <= Math.ceil(NAMED_WATER_COUNT / 4),
  };
  const ok = Object.values(checks).every(Boolean);

  const body = {
    status: ok ? "ok" : "degraded",
    build: { id: BUILD_ID, sha: BUILD.short, env: BUILD.env, builtAt: BUILD.builtAt },
    schemaVersion: SCHEMA_VERSION,
    records: NAMED_WATER_COUNT,
    bindings: { matched, total: bindingsFile.stats.records },
    bindingsGeneratedAt: bindingsFile.generatedAt,
    reviewOverdue: overdue,
    checks,
  };

  return (
    <main className="min-h-dvh bg-background p-6">
      <h1 className="sr-only">Field Sense Navigator health</h1>
      <p className="data mb-4 text-xs text-muted-foreground">
        Machine-readable JSON with a moving status code:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>{" "}
        ·{" "}
        <a className="underline" href="/api/version">
          /api/version
        </a>
      </p>
      <pre
        className="data overflow-x-auto text-xs text-foreground"
        tabIndex={0}
        role="region"
        aria-label="Health report"
      >
        {JSON.stringify(body, null, 2)}
      </pre>
    </main>
  );
}
