import { createFileRoute } from "@tanstack/react-router";

import { NAMED_WATER_COUNT, SCHEMA_VERSION } from "@/lib/catalog";
import { BUILD, BUILD_ID } from "@/lib/build-info";

/**
 * What is actually deployed here.
 *
 * The first question in every production investigation is "which build am I
 * looking at", and until this existed there was no way to answer it from
 * outside. A reader on a stale service-worker shell, a preview URL somebody
 * shared in a message, and the live site all looked identical.
 *
 * Cheap on purpose: four inlined constants and two catalog numbers, no
 * catalog scan, no network. `no-store` so the answer is the running server's,
 * never the CDN's memory of a server that has since been replaced.
 */
export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            app: "field-sense-navigator",
            buildId: BUILD_ID,
            sha: BUILD.sha,
            shortSha: BUILD.short,
            ref: BUILD.ref,
            builtAt: BUILD.builtAt,
            env: BUILD.env,
            schemaVersion: SCHEMA_VERSION,
            records: NAMED_WATER_COUNT,
          },
          {
            headers: {
              "cache-control": "no-store, max-age=0",
              "access-control-allow-origin": "*",
            },
          },
        ),
    },
  },
});
