#!/usr/bin/env node
/**
 * Accessibility audit across every route and every display mode.
 *
 * The contrast work this guards was not a one-off: the failures came from
 * translucent surfaces compositing over whatever sat behind them, which is
 * the kind of thing that comes back the moment someone reaches for a
 * translucent utility such as bg-brass at 15% again. It also checks the five display modes separately,
 * because the high-contrast modes were once the worst offenders — the
 * white mode bottomed out at 1.78:1, on the setting a low-vision reader
 * would deliberately choose.
 *
 * Starts its own dev server, audits, tears it down, and exits non-zero on
 * any violation. Needs a Chromium: set PLAYWRIGHT_BROWSERS_PATH, or run
 * `npx playwright install chromium` once.
 *
 *   node scripts/a11y-audit.mjs
 *   node scripts/a11y-audit.mjs --mode=white --route=/water/HHI-DEST-005
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

const ROUTES = [
  "/",
  "/explore",
  "/water/HHI-DEST-005",
  "/packet/HHI-DEST-005",
  "/compare",
  "/plan",
  "/watchlist",
  "/pipeline",
  "/boundary",
  "/health",
];
const MODES = ["dark", "light", "black", "white", "cvd"];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const PORT = Number(process.env.A11Y_PORT ?? 5199);
const BASE = `http://127.0.0.1:${PORT}`;

const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const only = { mode: arg("mode"), route: arg("route") };
const modes = only.mode ? [only.mode] : MODES;
const routes = only.route ? [only.route] : ROUTES;

let chromium;
let axeSource;
try {
  ({ chromium } = require_("playwright-core"));
  axeSource = readFileSync(require_.resolve("axe-core/axe.min.js"), "utf8");
} catch {
  console.error(
    "a11y-audit: needs playwright-core and axe-core.\n" +
      "  bun install            # they are devDependencies\n" +
      "  npx playwright install chromium",
  );
  process.exit(2);
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

const server = spawn(
  "npx",
  ["vite", "dev", "--host", "127.0.0.1", "--port", String(PORT)],
  { stdio: "ignore", shell: process.platform === "win32" },
);
const stop = () => {
  try {
    server.kill();
  } catch {
    /* already gone */
  }
};
process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

if (!(await waitForServer(BASE))) {
  stop();
  console.error(`a11y-audit: dev server never came up on ${BASE}`);
  process.exit(2);
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox"],
});

const findings = [];
for (const mode of modes) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    // Motion off is the app's own reduced-motion setting. Entrance
    // animations fade in over 900ms, and a colour sampled mid-fade is the
    // composite of a half-transparent element — not what anyone reads. This
    // measures the settled state, which is also what a reduced-motion
    // reader sees from the first frame.
    await ctx.addInitScript(
      `try{localStorage.setItem("hhi-theme",${JSON.stringify(mode)});` +
        `localStorage.setItem("hhi-motion","off")}catch(e){}`,
    );
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(
        async () => await window.axe.run(document, { resultTypes: ["violations"] }),
      );
      for (const v of result.violations) {
        for (const n of v.nodes) {
          findings.push({
            mode,
            viewport: vp.name,
            route,
            rule: v.id,
            impact: v.impact,
            target: (n.target ?? []).join(" "),
            detail: (n.failureSummary ?? "").replace(/\s+/g, " ").trim(),
          });
        }
      }
      // A page that scrolls sideways on a phone is a defect the rules miss.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) {
        findings.push({
          mode,
          viewport: vp.name,
          route,
          rule: "horizontal-overflow",
          impact: "serious",
          target: "html",
          detail: `page is ${overflow}px wider than the viewport`,
        });
      }
    }
    await ctx.close();
  }
}
await browser.close();
stop();

const checked = modes.length * VIEWPORTS.length * routes.length;
if (!findings.length) {
  console.log(`a11y-audit: ok (${checked} page views, 0 violations)`);
  process.exit(0);
}

const byRule = new Map();
for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
console.error(`a11y-audit: ${findings.length} violations across ${checked} page views\n`);
for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
  const first = findings.find((f) => f.rule === rule);
  console.error(`${rule} (${count})  e.g. ${first.mode}/${first.viewport} ${first.route}`);
  console.error(`   ${first.target}`);
  console.error(`   ${first.detail.slice(0, 220)}\n`);
}
process.exit(1);
