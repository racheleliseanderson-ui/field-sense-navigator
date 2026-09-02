import { createServerFn } from "@tanstack/react-start";

const MAX_MESSAGE = 400;
const MAX_STACK = 4000;
const MAX_ROUTE = 200;

/** Strip anything the reader typed or that could identify them. */
const clean = (value: unknown, limit: number): string =>
  String(value ?? "")
    .split(/[?#]/)[0]!
    .slice(0, limit);

export interface RawErrorReport {
  message: string;
  route: string;
  stack?: string;
  boundary?: string;
  viewport?: string;
}

/**
 * What actually leaves the browser. Exported so the boundary is testable:
 * a query string must never survive this, whatever the caller passes.
 */
export function sanitizeErrorReport(input: RawErrorReport) {
  return {
    message: String(input.message ?? "").slice(0, MAX_MESSAGE),
    route: clean(input.route, MAX_ROUTE),
    ...(input.stack ? { stack: String(input.stack).slice(0, MAX_STACK) } : {}),
    ...(input.boundary ? { boundary: clean(input.boundary, 80) } : {}),
    ...(input.viewport ? { viewport: clean(input.viewport, 20) } : {}),
  };
}

export const reportError = createServerFn({ method: "POST" })
  .validator(sanitizeErrorReport)
  .handler(async ({ data }) => {
    const { recordClientError } = await import("@/lib/errors.server");
    await recordClientError(data);
    return { recorded: true as const };
  });
