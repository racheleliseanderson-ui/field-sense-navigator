/**
 * Server-side sink for errors the reader actually hit.
 *
 * The instrument's data pipeline already reports its own failures — a
 * GitHub issue on every degraded ingest, and Discord or Slack when the
 * webhooks are set. The application serving that data reported nothing:
 * a reader could hit the error page and no one would ever know. This is
 * the missing half.
 *
 * Reports carry the route path, the message and the stack, and nothing
 * else. No query string (a search term is something the reader typed),
 * no identifier, no cookie, no third-party script — so the instrument
 * still collects nothing about the person holding it.
 */

const WEBHOOK_TIMEOUT_MS = 2500;

export interface ErrorReport {
  message: string;
  /** Route path only — never the query string. */
  route: string;
  stack?: string | undefined;
  /** Where it was caught: an error boundary, a loader, a server function. */
  boundary?: string | undefined;
  /** Coarse client hint, for reproducing a layout-specific break. */
  viewport?: string | undefined;
  releaseId?: string | undefined;
}

function releaseId(): string {
  const env = process.env as Record<string, string | undefined>;
  return env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ?? env["VERCEL_DEPLOYMENT_ID"] ?? "local";
}

/** One line per report, prefixed so a log drain can filter for it. */
export function formatReport(r: ErrorReport): string {
  const parts = [
    `route=${r.route}`,
    r.boundary ? `boundary=${r.boundary}` : null,
    r.viewport ? `viewport=${r.viewport}` : null,
    `release=${r.releaseId ?? releaseId()}`,
    `message=${JSON.stringify(r.message)}`,
  ].filter(Boolean);
  return `[client-error] ${parts.join(" ")}${r.stack ? `\n${r.stack}` : ""}`;
}

async function postWebhook(url: string, text: string): Promise<void> {
  const discord = url.includes("discord");
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      discord ? { content: text.slice(0, 1800) } : { text: text.slice(0, 3000) },
    ),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
}

/**
 * Record one report. Always logs; additionally posts to ERROR_WEBHOOK_URL
 * when it is set, matching how the ingest notifier is wired. A webhook
 * failure is never allowed to turn one error into two.
 */
export async function recordClientError(report: ErrorReport): Promise<void> {
  const line = formatReport({ ...report, releaseId: releaseId() });
  console.error(line);
  const url = process.env["ERROR_WEBHOOK_URL"];
  if (!url) return;
  try {
    await postWebhook(url, line);
  } catch {
    /* the log line above is the record of last resort */
  }
}
