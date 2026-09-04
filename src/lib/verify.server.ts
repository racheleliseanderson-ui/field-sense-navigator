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
    return { ...base, note: "This record does not name an official web page to check." };
  }

  const attempt = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          // Several agency hosts reject unfamiliar agents outright; a browser
          // string only affects whether we get an answer, never what we report.
          "user-agent": "Mozilla/5.0 (compatible; HoneyHoleIntelligence/0.4; source verification)",
          accept: "text/html,application/xhtml+xml",
        },
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
          ? `The agency has moved this page to ${finalUrl}`
          : "The agency page opened at the address on record.",
      };
    }
    return {
      ...base,
      httpStatus: res.status,
      finalUrl,
      redirected,
      note:
        res.status === 403 || res.status === 429
          ? "The agency site turns away automated checks. Open the page yourself to confirm it."
          : "The agency site answered, but not with the page on record. It could not be confirmed.",
    };
  } catch {
    return {
      ...base,
      note: "Couldn't reach the agency site in time. This source is not verified yet.",
    };
  }
}
