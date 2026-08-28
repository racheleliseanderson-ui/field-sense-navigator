type ErrorContext = Record<string, unknown>;

/**
 * Central client-side error sink. React error boundaries and route error
 * components funnel here so a single place decides what happens to a
 * caught error. Currently it logs; swap the body for a real reporter
 * (Sentry, a /api/errors endpoint, etc.) without touching call sites.
 */
export function reportClientError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;

  // Loaders and server functions commonly throw a raw Response; String(it)
  // is the opaque "[object Response]", so pull out the status and URL.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[client-error]", message, {
    route: window.location.pathname,
    ...(stack !== undefined && { stack }),
    ...context,
  });
}
