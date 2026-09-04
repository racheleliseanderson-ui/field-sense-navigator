import { reportError } from "@/lib/errors.functions";

type ErrorContext = Record<string, unknown>;

/**
 * Central client-side error sink. React error boundaries and route error
 * components funnel here so a single place decides what happens to a
 * caught error.
 *
 * It logs, and it posts the report to the server so the failure lands in
 * the deploy's logs — and in ERROR_WEBHOOK_URL when that is set. Until
 * this existed a reader could hit the error page and nobody would ever
 * know it had happened.
 *
 * Three guards keep a broken render from becoming a flood: identical
 * reports are sent once, a page view sends at most a handful, and a
 * failure to report is swallowed rather than raised — a reporter that
 * throws inside an error boundary takes the whole page down.
 */
const MAX_PER_PAGE_VIEW = 5;
const seen = new Set<string>();
let sent = 0;

/** Route path only. A query string can hold something the reader typed. */
function routePath(): string {
  if (typeof window === "undefined") return "unknown";
  return window.location.pathname || "/";
}

function viewport(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.innerWidth}x${window.innerHeight}`;
}

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
  const route = routePath();

  console.error("[client-error]", message, {
    route,
    ...(stack !== undefined && { stack }),
    ...context,
  });

  const key = `${route}|${message}`;
  if (seen.has(key) || sent >= MAX_PER_PAGE_VIEW) return;
  seen.add(key);
  sent += 1;

  const boundary = typeof context["boundary"] === "string" ? context["boundary"] : undefined;
  const vp = viewport();

  void reportError({
    data: {
      message,
      route,
      ...(stack !== undefined && { stack }),
      ...(boundary !== undefined && { boundary }),
      ...(vp !== undefined && { viewport: vp }),
    },
  }).catch(() => {
    /* reporting must never be the thing that breaks the page */
  });
}
