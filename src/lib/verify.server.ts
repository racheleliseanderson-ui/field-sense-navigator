export interface SourceVerification {
  ok: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  redirected: boolean;
  note: string;
  checkedAt: string;
}

const TIMEOUT_MS = 9000;

/**
 * Reads the official agency page the record cites and reports what the network
 * actually returned. Nothing about the page's contents is inferred: an
 * unreachable source is reported as unverified, never as clear.
 */
export async function verifySource(url: string): Promise<SourceVerification> {
  const checkedAt = new Date().toISOString();
  const base: SourceVerification = {
    ok: false,
    httpStatus: null,
    finalUrl: null,
    redirected: false,
    note: "",
    checkedAt,
  };

  if (!/^https?:\/\//i.test(url)) {
    return { ...base, note: "Record does not cite an http(s) source URL." };
  }

  const attempt = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "user-agent": "HoneyHoleIntelligence/0.4 (source verification)" },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await attempt("HEAD");
    // Several agency hosts refuse HEAD outright; re-read with GET before judging.
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await attempt("GET");
    }
    const finalUrl = res.url || url;
    const redirected = finalUrl.replace(/\/$/, "") !== url.replace(/\/$/, "");
    if (res.ok) {
      return {
        ...base,
        ok: true,
        httpStatus: res.status,
        finalUrl,
        redirected,
        note: redirected
          ? `Reachable, but the agency now serves this page at ${finalUrl}`
          : "Agency page reachable at the cited URL.",
      };
    }
    return {
      ...base,
      httpStatus: res.status,
      finalUrl,
      redirected,
      note: `Agency host answered ${res.status}. The cited page could not be confirmed.`,
    };
  } catch {
    return {
      ...base,
      note: "No answer from the agency host within the timeout. Source left unverified.",
    };
  }
}
