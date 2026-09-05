/**
 * Field Sense Navigator service worker.
 *
 * The catalogue, the water-reading craft, the plan view and your watchlist are all
 * local. What is NOT local is every live reading this instrument shows — gauge
 * height, flow, temperature, forecast — and none of it is cached, because a
 * stale river level presented as a current one is the single most dangerous
 * thing this app could do. Offline, the craft is there and the readings are
 * honestly absent.
 *
 * FLEET PATTERN. Everything below the config block is identical in every Hook
 * app that has one, on purpose — a service worker is the single easiest file
 * in a web app to get subtly wrong, and seven slightly different ones is seven
 * separate ways to serve somebody a page from three deploys ago. Fix it here
 * and apply the same diff everywhere.
 *
 * The strategy is deliberately conservative:
 *
 *   - Navigations go to the network first, then to the cached copy of that
 *     route, then to the cached home page. Online, you always get the current
 *     build; the stale case only exists when there is no alternative.
 *   - Hashed build assets are cache first. They never change in place.
 *   - Server functions and anything under /api/ are network only. Live data
 *     that is out of date is worse than live data that is missing.
 *
 * ── Why BUILD_ID is stamped, and what went wrong without it ──────────────
 *
 * VERSION used to be the literal string "fsn-v1", so this file was
 * byte-identical on every deploy. A browser only treats a worker as new when
 * its bytes change, so `install` ran exactly once in a reader's lifetime: on
 * their first visit. Every deploy after that left the offline shell frozen at
 * whatever the catalogue looked like the day they first opened the app —
 * online they got the current build, offline they got July. For a field
 * instrument whose whole promise is that it works at the ramp with no signal,
 * that is the worst possible half of the app to freeze.
 *
 * `scripts/stamp-sw.mjs` now replaces the token below with the build id after
 * every production build, so a deploy is what expires an offline shell.
 * The literal below is the development value and is never shipped: the build
 * asserts the stamp landed.
 */

/** Replaced at build time by scripts/stamp-sw.mjs. */
const BUILD_ID = "__BUILD_ID__";

/** The surfaces worth having with no signal, prefetched on install. */
const OFFLINE_ROUTES = ["/", "/explore", "/reading", "/plan", "/watchlist", "/boundary"];

/** Shown only when a page was never cached and there is no network. */
const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Field Sense Navigator — offline</title>
<body style="margin:0;background:#0b1117;color:#e8eef3;font:16px/1.6 system-ui;padding:2.5rem 1.5rem">
<p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#c8a24a;margin:0">No signal</p>
<h1 style="font-size:1.6rem;margin:.75rem 0 0">This page is not on the device yet</h1>
<p style="max-width:34rem;color:#93a3ae">Open the navigator once with a connection and the water-reading pages, the plan view and your watchlist are available without one. Live gauge, flow and forecast readings are never cached — an old river level shown as a current one is worse than no river level.</p>
</body>`;

/*
 * Two caches with two different lifetimes, on purpose.
 *
 * SHELL holds rendered HTML, which goes out of date the moment a record
 * changes, so it is keyed on the build and a deploy discards it.
 *
 * ASSETS holds hashed build files, whose URLs already carry their version — a
 * hit is correct forever, and re-keying it per build would make every deploy
 * re-download the whole catalogue chunk over whatever signal a reader has at
 * the ramp. It is pruned by size instead of by version.
 */
const SHELL = `fsn-shell-${BUILD_ID}`;
const ASSETS = "fsn-assets";

/** How many hashed files to keep. Comfortably more than one build needs. */
const ASSET_CACHE_LIMIT = 160;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      /* Best effort. A route that fails to prefetch simply is not offline
         yet, which is a better outcome than an install that fails whole. */
      await Promise.allSettled(
        OFFLINE_ROUTES.map(async (route) => {
          const res = await fetch(route, { credentials: "same-origin", cache: "reload" });
          if (res.ok) await cache.put(route, res.clone());
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL && k !== ASSETS)
          .filter((k) => k.startsWith("fsn-") || k.startsWith("fsn-v"))
          .map((k) => caches.delete(k)),
      );
      await pruneAssets();
      await self.clients.claim();
    })(),
  );
});

/**
 * Keep the hashed-asset cache bounded.
 *
 * `cache.keys()` returns insertion order, so the oldest entries are the ones
 * least likely to belong to a build anybody is still running. Without this the
 * cache grows by a whole build every deploy and never sheds one, which on this
 * app is several megabytes a time.
 */
async function pruneAssets() {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  const excess = keys.length - ASSET_CACHE_LIMIT;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

function isBuildAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_build/") ||
      url.pathname.startsWith("/assets/") ||
      /\.(?:css|js|woff2?|png|jpe?g|webp|svg|ico|webmanifest)$/.test(url.pathname))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Live data is never cached. Stale readings are worse than no readings, and
     "unavailable" has to keep meaning unavailable. */
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_serverFn")) return;

  /* The worker's own file and the published live snapshot must always come
     from the network, or a reader can be pinned to an old worker for as long
     as the cache survives. */
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/live/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(SHELL);
            cache.put(new Request(url.pathname, { credentials: "same-origin" }), fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(SHELL);
          const hit =
            (await cache.match(url.pathname)) ??
            (await cache.match(req)) ??
            (await cache.match("/"));
          if (hit) return hit;
          return new Response(OFFLINE_PAGE, {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
