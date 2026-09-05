/**
 * Which build is this?
 *
 * A production application that cannot name itself has to be diagnosed by
 * guesswork. A reader reports that a water shows the wrong access wording;
 * without this, there is no way to tell whether they are looking at the
 * current deploy, a service-worker shell cached weeks ago, or a preview URL
 * somebody shared. Every answer to that question starts here.
 *
 * The four constants are replaced at build time by `vite.base.config.ts`.
 * They are `define` substitutions, not variables, so they must never be
 * referenced anywhere but this file — a stray `__BUILD_SHA__` in a module the
 * bundler does not process is a ReferenceError at runtime. Import from here.
 *
 * `typeof X === "undefined"` is the guard that survives substitution: after
 * replacement it reads `typeof "abc123" === "undefined"` and folds to false,
 * and before replacement — a bare `bun test`, a script importing this
 * directly — it is the only form that does not throw.
 *
 * FLEET PATTERN. This module takes no imports and is copied as-is into any
 * Hook app that carries `vite.base.config.ts`.
 */

declare const __BUILD_SHA__: string;
declare const __BUILD_REF__: string;
declare const __BUILD_TIME__: string;
declare const __BUILD_ENV__: string;

export interface BuildInfo {
  /** Full commit sha of the deployed tree, or "unknown". */
  sha: string;
  /** First 7 characters — what a person actually reads and quotes. */
  short: string;
  /** Branch the build came from, where the host names one. */
  ref: string;
  /** When the bundle was produced, ISO 8601. Not when it was deployed. */
  builtAt: string;
  /** "production" | "preview" | "development" | "local". */
  env: string;
}

const sha = typeof __BUILD_SHA__ === "undefined" ? "unknown" : __BUILD_SHA__ || "unknown";

export const BUILD: BuildInfo = {
  sha,
  short: sha.slice(0, 7),
  ref: typeof __BUILD_REF__ === "undefined" ? "" : __BUILD_REF__,
  builtAt: typeof __BUILD_TIME__ === "undefined" ? "unknown" : __BUILD_TIME__ || "unknown",
  env: typeof __BUILD_ENV__ === "undefined" ? "local" : __BUILD_ENV__ || "local",
};

/**
 * The single string that identifies a deployment in a log line, a cache key or
 * a bug report.
 *
 * It is the short commit sha and nothing else, because `scripts/stamp-sw.mjs`
 * has to produce the same string in a different process and anything derived
 * from the clock would disagree. That is also the honest semantics: two builds
 * of one commit are the same application and should share an offline shell.
 */
export const BUILD_ID = BUILD.short;
