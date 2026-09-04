/**
 * Offline, made visible.
 *
 * Two jobs. Register the service worker so the app opens with no signal, and
 * say plainly when the signal has gone — because what survives a lost signal here is very specific, and what
 * does not is the half that could get somebody hurt.
 *
 * FLEET PATTERN. The mechanism matches the other Hook apps; only the sentence
 * in the banner differs, because what survives a lost signal differs.
 */

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    /* A service worker on a plain-http origin is either impossible or a
       development footgun. Neither is worth a try/catch in production. */
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* No offline support in this browser. Everything still works online. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="sticky top-0 z-50 border-b border-alert/50 bg-alert/10 px-4 py-2"
    >
      <p className="text-xs leading-snug">
        <span className="font-mono uppercase tracking-[0.16em] text-alert">No signal</span>{" "}
        <span className="text-muted-foreground">
          — the water-reading pages, the plan view and your watchlist all still work. Gauge height,
          flow, temperature and forecast do not, and they are never served from a cache: an old
          river level shown as a current one is worse than no river level at all.
        </span>
      </p>
    </div>
  );
}
