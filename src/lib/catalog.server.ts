/**
 * Reader for the catalog's Postgres replica.
 *
 * The replica answers one question — which records match these words, best
 * first — and the application keeps everything else on the device. So every
 * failure here is a quality regression, never a broken page: this module
 * returns `null` for missing configuration, a timeout, an HTTP error, a
 * malformed body, or a replica that has not been marked current. It never
 * throws, and no caller is allowed to depend on it succeeding.
 *
 * Server-only. The key stays out of the client bundle.
 */

/** Beyond this a stale in-memory answer beats a slow correct one. */
const TIMEOUT_MS = 2500;

export interface ReplicaMatch {
  /** Catalog ids, best match first. */
  ids: string[];
  total: number;
}

let warned = false;
function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.warn(`[catalog replica] ${message} — falling back to the bundled catalog.`);
}

function config(): { url: string; key: string } | null {
  const url = process.env["SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) {
    warnOnce("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set");
    return null;
  }
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Ranked ids for a text query, or null when the replica cannot answer.
 *
 * `ready` comes from the database itself: it is false until a publish has been
 * marked current with at least the build's own 500-record floor, so a seeded or
 * half-loaded replica declines rather than serving a short answer.
 */
export async function matchIds(q: string): Promise<ReplicaMatch | null> {
  const term = q.trim();
  if (term.length < 2) return null;

  const cfg = config();
  if (!cfg) return null;

  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/ww_match_ids`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ q: term.slice(0, 120) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      warnOnce(`replica returned ${res.status}`);
      return null;
    }

    const body: unknown = await res.json();
    const row = Array.isArray(body) ? body[0] : body;
    if (!row || typeof row !== "object") return null;

    const { ready, ids, total } = row as {
      ready?: unknown;
      ids?: unknown;
      total?: unknown;
    };

    // The replica's own judgement that it is publishable. Trust it over ours.
    if (ready !== true) return null;
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === "string")) {
      return null;
    }

    return { ids, total: typeof total === "number" ? total : ids.length };
  } catch (error) {
    // Timeout, DNS, TLS, offline — all the same answer: use what we have.
    warnOnce(error instanceof Error ? error.name : "request failed");
    return null;
  }
}
