/**
 * Stamp the build id into the emitted service worker, and prove it landed.
 *
 * ── The bug this exists to close ────────────────────────────────────────
 *
 * `public/sw.js` used to carry a literal `VERSION = "fsn-v1"`. Nothing in the
 * build ever changed it, so the file the browser downloaded was byte-identical
 * on every deploy. A browser only treats a worker as new when its bytes
 * differ, so `install` ran once in a reader's lifetime — on their first visit
 * — and never again. `activate` deletes caches that do not match VERSION, and
 * VERSION never moved, so nothing was ever discarded either.
 *
 * The consequence was invisible online, where navigations are network-first
 * and always current. Offline it was the whole point of the app going wrong:
 * an angler who installed the navigator in July and opened it at a ramp with
 * no signal in December was reading July's catalogue, with no indication that
 * it was old.
 *
 * ── What this does ──────────────────────────────────────────────────────
 *
 * Vite copies `public/sw.js` to the emitted static directory untouched, so the
 * substitution happens on the output, not on the file in git. The token stays
 * in the source, which keeps `public/sw.js` readable and keeps `git status`
 * clean after a build.
 *
 * It then asserts. A stamping step that quietly does nothing is worse than no
 * stamping step, because the frozen-shell bug comes straight back and the
 * build still passes — so a missing output, a missing token or a surviving
 * token all fail the build loudly.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildId } from "./build-id.mjs";

const TOKEN = "__BUILD_ID__";

/**
 * Where the build put the public directory.
 *
 * Nitro's Vercel preset emits `.vercel/output/static`; a preset-less or
 * differently-hosted build emits `dist/client`. Both are checked rather than
 * assumed, because a stamp that silently targets the wrong directory is
 * exactly the failure mode this script exists to prevent.
 */
const CANDIDATE_DIRS = [
  join(".vercel", "output", "static"),
  join("dist", "client"),
  "dist",
  ".output/public",
];

function emittedWorkers() {
  const found = [];
  for (const dir of CANDIDATE_DIRS) {
    const file = join(dir, "sw.js");
    if (existsSync(file)) found.push(file);
  }
  return found;
}

function fail(message) {
  console.error(`stamp-sw: ${message}`);
  process.exit(1);
}

const id = buildId();
const workers = emittedWorkers();

if (workers.length === 0) {
  const seen = CANDIDATE_DIRS.filter((d) => existsSync(d))
    .map((d) => `${d}/ -> ${readdirSync(d).slice(0, 8).join(", ")}`)
    .join("; ");
  fail(
    `no emitted sw.js in any of ${CANDIDATE_DIRS.join(", ")}. ` +
      `Run this after the build, not before.${seen ? ` Saw: ${seen}` : ""}`,
  );
}

for (const file of workers) {
  const before = readFileSync(file, "utf8");
  if (!before.includes(TOKEN)) {
    fail(
      `${file} does not contain ${TOKEN}. public/sw.js must declare ` +
        `const BUILD_ID = "${TOKEN}" or the offline shell never expires.`,
    );
  }
  const after = before.split(TOKEN).join(id);
  writeFileSync(file, after);

  const verify = readFileSync(file, "utf8");
  if (verify.includes(TOKEN)) fail(`${file} still contains ${TOKEN} after writing`);
  if (!verify.includes(`const BUILD_ID = "${id}"`)) {
    fail(`${file} does not declare the stamped id ${id}`);
  }
  console.log(`stamp-sw: ${file} -> ${id}`);
}
