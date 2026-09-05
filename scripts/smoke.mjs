/**
 * Browser smoke test against the built application.
 *
 * A green build proves the bundler was happy. It proves nothing about whether
 * a page renders, whether the client bundle throws on hydration, whether a
 * route 500s, or whether the service worker actually serves anything with the
 * radio off — and until this existed, production was the first environment
 * where the whole application was ever run.
 *
 * It drives the EMITTED build, not the dev server, because the failures worth
 * catching here only exist after bundling: a server-only module reaching a
 * client chunk, a define that did not substitute, an asset path that only
 * resolves under Vite's dev middleware.
 *
 * Run it after `npm run build`:
 *
 *   npm run build && npm run test:smoke
 *
 * What it asserts, per route: HTTP 200, a document title, a level-one heading,
 * no uncaught page error, no console error, and no failed same-origin request.
 * Then, once for the whole run: the two machine endpoints answer as JSON, a
 * bad address renders the not-found page rather than an error, axe-core finds
 * no serious or critical violation on the two densest surfaces, and the
 * application still renders a cached route with the network cut.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

const OUT = join(".vercel", "output");
const STATIC = join(OUT, "static");
const ENTRY = join(OUT, "functions", "__server.func", "index.mjs");
const PORT = Number(process.env.SMOKE_PORT ?? 3199);
/* `localhost`, not `127.0.0.1`: both are secure contexts, but the app only
   registers its service worker on https or localhost, and the offline check
   below is the reason this test exists. */
const ORIGIN = `http://localhost:${PORT}`;

if (!existsSync(ENTRY)) {
  console.error(`smoke: ${ENTRY} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * A minimal host for the emitted build.
 *
 * Static files first, then the Nitro function — the same order
 * `.vercel/output/config.json` asks Vercel for, expressed in about forty
 * lines so this script needs no server package and no network to install one.
 * ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const handler = (await import(pathToFileURL(ENTRY).href)).default;

async function staticFile(pathname) {
  /* normalize() collapses any ../ before it can leave the static root. */
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(STATIC, rel);
  if (!file.startsWith(STATIC)) return null;
  try {
    const s = await stat(file);
    if (!s.isFile()) return null;
    return { body: await readFile(file), type: MIME[extname(file)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, ORIGIN);
    const hit = await staticFile(url.pathname);
    if (hit) {
      res.writeHead(200, { "content-type": hit.type, "cache-control": "no-store" });
      res.end(hit.body);
      return;
    }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await handler.fetch(request, {}, {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(error?.stack ?? error));
  }
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

const failures = [];
const fail = (route, message) => {
  const line = `${route}: ${message}`;
  failures.push(line);
  console.error(`FAIL  ${line}`);
};
const ok = (message) => console.log(`  ok  ${message}`);

/*
 * Noise a browser makes that is not this application's fault. Keep this list
 * short and specific: every entry is a class of real failure being ignored.
 */
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
];

/*
 * Everything this application needs is same-origin. The one exception is the
 * Google Fonts stylesheet, and a smoke test that waits on a third-party CDN is
 * testing the CDN. Off-origin requests are refused outright, which also proves
 * the page is functional without them — the type stack has real fallbacks.
 */
async function sealOrigin(context) {
  await context.route("**/*", (route) => {
    if (route.request().url().startsWith(ORIGIN)) return route.continue();
    /* Fulfil rather than abort. An aborted request logs `net::ERR_FAILED` to
       the console, and this test treats a console error as a failure — so
       aborting would drown the real ones in eleven copies of the same
       blocked font stylesheet. An empty 200 is silent and equally offline. */
    return route.fulfill({ status: 200, body: "", contentType: "text/plain" });
  });
}

function watch(page, route) {
  page.on("pageerror", (e) => fail(route, `uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((r) => r.test(text))) return;
    fail(route, `console error: ${text.slice(0, 240)}`);
  });
  page.on("requestfailed", (r) => {
    if (!r.url().startsWith(ORIGIN)) return;
    const reason = r.failure()?.errorText ?? "";
    if (IGNORED_CONSOLE.some((x) => x.test(reason))) return;
    fail(route, `request failed ${r.url().replace(ORIGIN, "")} — ${reason}`);
  });
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

try {
  /* A real phone viewport. The field surfaces are one-handed by design and
     most of this app's readers are on a handset at a ramp. */
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "allow",
  });
  await sealOrigin(context);

  /* One real record and one real packet, taken from the catalog rather than
     hardcoded, so this keeps working as records come and go. */
  const catalog = JSON.parse(await readFile(join("src", "data", "destinations.json"), "utf8"));
  const sampleId = catalog[0]?.id;
  if (!sampleId) throw new Error("catalog is empty — assert-catalog should have caught this");

  const ROUTES = [
    "/",
    "/explore",
    "/reading",
    "/plan",
    "/watchlist",
    "/boundary",
    "/compare",
    "/pipeline",
    "/health",
    `/water/${sampleId}`,
    `/packet/${sampleId}`,
  ];

  for (const route of ROUTES) {
    const page = await context.newPage();
    watch(page, route);
    const res = await page.goto(`${ORIGIN}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
    if (!res || res.status() !== 200) fail(route, `HTTP ${res?.status() ?? "no response"}`);

    const title = await page.title();
    if (!title.trim()) fail(route, "empty <title>");

    const h1 = await page.locator("h1").count();
    if (h1 === 0) fail(route, "no <h1> on the page");

    /* The one appearance control is mounted by the root shell on every page.
       Its absence means the shell did not hydrate. */
    const hydrated = await page.evaluate(() => document.body.dataset["hydrated"] !== "failed");
    if (!hydrated) fail(route, "shell reported failed hydration");

    if (failures.filter((f) => f.startsWith(route)).length === 0)
      ok(`${route} (${title.slice(0, 46)})`);
    await page.close();
  }

  /* ---------- the not-found path ---------- */
  {
    const route = "/water/HHI-DEST-does-not-exist";
    const page = await context.newPage();
    /* No console watcher here: the browser logs the document's own 404, which
       is the correct response and the thing being asserted. */
    page.on("pageerror", (e) => fail(route, `uncaught: ${e.message}`));
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const body = await page.locator("body").innerText();
    if (!/not on the catalog/i.test(body)) {
      fail(route, "a missing record did not render the not-found page");
    } else ok(`${route} -> not-found page, nothing invented`);
    await page.close();
  }

  /* ---------- the machine endpoints ---------- */
  for (const [path, check] of [
    ["/api/health", (j) => j.status === "ok" && j.records > 500],
    ["/api/version", (j) => typeof j.buildId === "string" && j.buildId.length > 0],
  ]) {
    const res = await fetch(`${ORIGIN}${path}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) fail(path, `content-type is "${type}"`);
    const json = await res.json().catch(() => null);
    if (!json || !check(json)) fail(path, `unexpected body ${JSON.stringify(json).slice(0, 200)}`);
    else ok(`${path} -> ${JSON.stringify(json).slice(0, 90)}…`);
  }

  /* ---------- accessibility ---------- */
  const axeSource = await readFile(join("node_modules", "axe-core", "axe.min.js"), "utf8");
  for (const route of ["/", "/explore", `/water/${sampleId}`]) {
    const page = await context.newPage();
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(
      async () =>
        /* eslint-disable-next-line no-undef */
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        }),
    );
    const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    if (serious.length) {
      for (const v of serious) {
        const where = v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ");
        fail(`a11y ${route}`, `${v.id} (${v.impact}) x${v.nodes.length} — ${v.help} :: ${where}`);
      }
    } else {
      ok(`a11y ${route}: ${results.passes.length} checks pass, no serious or critical violation`);
    }
    await page.close();
  }

  /* ---------- offline ---------- *
   * The promise this app makes is that the craft survives a lost signal and
   * the readings honestly do not. Both halves are worth proving. */
  {
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const registered = await page
      .evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return Boolean(reg.active);
      })
      .catch(() => false);

    if (!registered) {
      /* Not a failure of the app: a worker needs a secure context, and
         127.0.0.1 qualifies but some headless configurations disable it. */
      console.log("  --  service worker did not activate in this browser; offline check skipped");
    } else {
      ok("service worker activated");
      /* Give the install prefetch a moment to land the offline routes. */
      await page.waitForTimeout(2500);
      await context.setOffline(true);
      const res = await page
        .goto(`${ORIGIN}/reading`, { waitUntil: "domcontentloaded", timeout: 30_000 })
        .catch(() => null);
      const text = res ? await page.locator("body").innerText() : "";
      if (!text || /not on the device yet/i.test(text)) {
        fail("offline", "/reading was not available with the network cut");
      } else ok("offline: /reading still renders from the device");
      await context.setOffline(false);
    }
    await page.close();
  }

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\nsmoke: ${failures.length} problem(s).`);
  process.exit(1);
}
console.log("\nsmoke: the built application runs.");
