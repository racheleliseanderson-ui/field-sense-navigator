/**
 * The one place a build names itself.
 *
 * Two processes need the same answer and they run minutes apart: the Vite
 * config, which inlines it into the client bundle, and `stamp-sw.mjs`, which
 * writes it into the emitted service worker after the build. Anything derived
 * from the clock would disagree between them, so the id is the commit — which
 * is also the honest thing for it to be, because two builds of one commit are
 * the same application and should share an offline shell.
 *
 * Plain `.mjs` with no dependencies so both callers can import it: the Vite
 * config is TypeScript, `stamp-sw.mjs` is a build script, and neither should
 * need a build step to read this.
 */
import { execFileSync } from "node:child_process";

/** Full commit sha of the tree being built, or "unknown". */
export function buildSha() {
  const env = process.env;
  const hosted = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA || "";
  if (hosted) return hosted;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/** The short form everything user-visible quotes, and the cache key. */
export function buildId() {
  return buildSha().slice(0, 7) || "unknown";
}

/** Branch, where the host names one. Empty string when it does not. */
export function buildRef() {
  return process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || "";
}

/** Which environment produced this build. */
export function buildEnv() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
}
