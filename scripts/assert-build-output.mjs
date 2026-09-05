/**
 * Assert the shape of what was actually built.
 *
 * `assert-catalog.mjs` guards the input; this guards the output. The two
 * failures it exists to catch have both happened to apps in this fleet and
 * neither one fails a build on its own:
 *
 *   - Nitro emitting a preset other than `vercel`, so the deployment is a
 *     worker for a platform this app is never deployed to. The build is green
 *     and the site is a 404.
 *   - The service worker shipping with its `__BUILD_ID__` token unstamped, or
 *     stamped into a directory nothing serves, which silently restores the
 *     frozen-offline-shell bug that `stamp-sw.mjs` exists to close.
 *
 * Run after `npm run build`. It reads the emitted tree and nothing else.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildId } from "./build-id.mjs";

const OUT = join(".vercel", "output");
const STATIC = join(OUT, "static");

const failures = [];
const notes = [];

const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);

/* ---------- the deployment shape ---------- */

if (!existsSync(OUT)) {
  fail(`${OUT} does not exist. Production is Vercel-only; run \`npm run build\` first.`);
} else {
  const configPath = join(OUT, "config.json");
  if (!existsSync(configPath))
    fail(`${configPath} missing — no Build Output API config was emitted`);
  else {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    if (config.version !== 3) fail(`Build Output API version is ${config.version}, expected 3`);
    const routes = JSON.stringify(config.routes ?? []);
    if (!routes.includes("/__server"))
      fail("config.json has no route falling through to /__server");
    note(`Build Output API v${config.version}, ${(config.routes ?? []).length} routes`);
  }

  const nitroPath = join(OUT, "nitro.json");
  if (!existsSync(nitroPath)) fail(`${nitroPath} missing — Nitro did not report its build`);
  else {
    const nitro = JSON.parse(readFileSync(nitroPath, "utf8"));
    if (nitro.preset !== "vercel") {
      fail(
        `Nitro preset is "${nitro.preset}", expected "vercel". This app deploys to Vercel only.`,
      );
    }
    note(`Nitro ${nitro.versions?.nitro ?? "?"} preset=${nitro.preset}`);
  }

  const funcConfig = join(OUT, "functions", "__server.func", ".vc-config.json");
  if (!existsSync(funcConfig)) fail(`${funcConfig} missing — no server function was emitted`);
  else {
    const vc = JSON.parse(readFileSync(funcConfig, "utf8"));
    if (!/^nodejs\d+\.x$/.test(vc.runtime ?? ""))
      fail(`server function runtime is "${vc.runtime}"`);
    note(`server function runtime=${vc.runtime} streaming=${vc.supportsResponseStreaming}`);
  }
}

/* ---------- the service worker ---------- */

const swPath = join(STATIC, "sw.js");
if (!existsSync(swPath)) {
  fail(`${swPath} missing — the app registers /sw.js and would 404 on it`);
} else {
  const sw = readFileSync(swPath, "utf8");
  if (sw.includes("__BUILD_ID__")) {
    fail(
      "sw.js shipped with its __BUILD_ID__ token unstamped — the offline shell would never expire",
    );
  }
  const id = buildId();
  if (!sw.includes(`const BUILD_ID = "${id}"`)) {
    fail(`sw.js is not stamped with the current build id (${id})`);
  } else {
    note(`service worker stamped ${id}`);
  }
}

/* ---------- the installable surface ---------- */

for (const required of [
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "robots.txt",
  "sitemap.xml",
]) {
  if (!existsSync(join(STATIC, required))) fail(`${join(STATIC, required)} missing`);
}

const manifestPath = join(STATIC, "manifest.webmanifest");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const maskable = (manifest.icons ?? []).some((i) => (i.purpose ?? "").includes("maskable"));
  if (!maskable)
    fail("manifest declares no maskable icon — Android home screens crop the square one");
  if (manifest.display !== "standalone") note(`manifest display=${manifest.display}`);
}

/* ---------- payload ---------- */

const assetsDir = join(STATIC, "assets");
if (existsSync(assetsDir)) {
  let bytes = 0;
  let biggest = { name: "", size: 0 };
  for (const name of readdirSync(assetsDir)) {
    if (!/\.(js|css)$/.test(name)) continue;
    const size = statSync(join(assetsDir, name)).size;
    bytes += size;
    if (size > biggest.size) biggest = { name, size };
  }
  const mb = (bytes / 1048576).toFixed(2);
  note(
    `client js+css ${mb} MB across ${readdirSync(assetsDir).length} files; largest ${biggest.name} ${(biggest.size / 1048576).toFixed(2)} MB`,
  );
  /*
   * A ceiling, not a target. This app deliberately ships the whole catalogue
   * to the device — that is what makes every water record readable at a ramp
   * with no signal, and it is the product's central promise. The number is
   * here so growth is a decision somebody makes rather than something that
   * happens: when this trips, either the records got heavier for a reason, or
   * it is time for the compact search index that AGENTS.project.md describes.
   */
  const CEILING_MB = 6;
  if (bytes / 1048576 > CEILING_MB) {
    fail(
      `client bundle is ${mb} MB, over the ${CEILING_MB} MB ceiling. ` +
        `See "Scale (same app, later)" in AGENTS.project.md — this is the signal to shard or index, not to raise the number without reading it.`,
    );
  }
}

/* ---------- report ---------- */

for (const n of notes) console.log(`  ok  ${n}`);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\nassert-build-output: ${failures.length} problem(s) with the emitted build.`);
  process.exit(1);
}
console.log(`\nassert-build-output: emitted build looks right.`);
