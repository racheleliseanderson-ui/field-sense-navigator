import { createFileRoute } from "@tanstack/react-router";

import { NAMED_WATER_COUNT, SCHEMA_VERSION, destinations, reviewOverdue } from "@/lib/catalog";
import { bindingsFile } from "@/lib/bindings";
import { BUILD, BUILD_ID } from "@/lib/build-info";

/**
 * The machine-readable heartbeat.
 *
 * `/health` is the same report as a page a person can read. This is the one an
 * uptime probe should watch: `application/json`, no markup to parse, and a
 * `cache-control: no-store` so a CDN can never answer for a server that is
 * gone. A monitor matches on `status == "ok"`.
 *
 * Deliberately local-only. It renders from the committed catalog and the
 * committed binding file and makes no network call, so it answers in
 * milliseconds and cannot flap because an agency was slow. Live-plane
 * freshness is a different question and it is answered, in full, on
 * `/pipeline`.
 *
 * It never 500s. A failing invariant flips `status` to `"degraded"` and names
 * the check, because a health endpoint that dies tells you less than one that
 * explains. The HTTP status still moves — 200 healthy, 503 degraded — so a
 * probe that only reads status codes is not lied to.
 */

const MIN_RECORDS = 500;
const MIN_MATCHED_BINDINGS = 400;

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        const matched = bindingsFile.stats.matched;
        const overdue = destinations.filter((d) => reviewOverdue(d)).length;

        const checks = {
          catalog_loaded: NAMED_WATER_COUNT >= MIN_RECORDS,
          bindings_loaded: matched >= MIN_MATCHED_BINDINGS,
          review_queue_bounded: overdue <= Math.ceil(NAMED_WATER_COUNT / 4),
        };
        const ok = Object.values(checks).every(Boolean);

        return Response.json(
          {
            status: ok ? "ok" : "degraded",
            build: { id: BUILD_ID, sha: BUILD.short, env: BUILD.env, builtAt: BUILD.builtAt },
            schemaVersion: SCHEMA_VERSION,
            records: NAMED_WATER_COUNT,
            bindings: {
              matched,
              total: bindingsFile.stats.records,
              generatedAt: bindingsFile.generatedAt,
            },
            reviewOverdue: overdue,
            checks,
            checkedAt: new Date().toISOString(),
          },
          {
            status: ok ? 200 : 503,
            headers: {
              "cache-control": "no-store, max-age=0",
              /* A status page on another origin is a legitimate reader of a
                 health endpoint, and there is nothing here that is not
                 already public. */
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
