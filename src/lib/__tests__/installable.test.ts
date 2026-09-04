import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The manifest is the difference between a website somebody bookmarks and an
 * instrument that sits on a home screen and opens in a canyon. It is also
 * silent when it is wrong: a bad icon path does not fail a build, it just
 * gives the reader a blurry favicon on a white square and no way to know why.
 *
 * So the checks are the ones a browser makes and never reports — every file
 * the manifest names exists, the icons cover the sizes an installer looks
 * for, one of them is maskable, and every shortcut points at a route this app
 * actually has.
 */

const PUBLIC = join(import.meta.dir, "../../../public");
const ROUTES = join(import.meta.dir, "../../routes");

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  shortcuts?: { name: string; url: string }[];
}

const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8")) as Manifest;

describe("the app can be installed", () => {
  test("it declares a standalone window and its own colours", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/");
    /* Against the app's own ground, not a default white flash. */
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("the short name fits a home screen", () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(14);
  });

  test("every icon file it names is actually there", () => {
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(true);
      expect(existsSync(join(PUBLIC, icon.src.slice(1)))).toBe(true);
    }
  });

  test("it covers the sizes an installer looks for, including a maskable one", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    /* Without this Android crops the square art into a circle and eats the
       edges of the drawing. */
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  test("iOS has a touch icon, because it ignores the manifest for that", () => {
    expect(existsSync(join(PUBLIC, "apple-touch-icon.png"))).toBe(true);
  });

  test("every shortcut points at a route this app has", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      const slug = shortcut.url.replace(/^\//, "");
      expect(existsSync(join(ROUTES, `${slug}.tsx`))).toBe(true);
    }
  });

  test("every shortcut is prefetched by the service worker", () => {
    /*
     * This is the whole point of a shortcut on a fishing app: it is pressed
     * from a home screen, on a bank, with no bars. One that opens a page the
     * worker never cached fails in exactly the situation it exists for.
     *
     * Compared on the pathname, because a shortcut may carry a query the
     * client reads and the worker caches by path.
     */
    const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");
    const block = sw.match(/const OFFLINE_ROUTES\s*=\s*\[([^\]]*)\]/);
    expect(block).toBeTruthy();
    const cached = [...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(cached).toContain("/");
    for (const shortcut of manifest.shortcuts ?? []) {
      const path = shortcut.url.split("?")[0] || "/";
      expect(cached).toContain(path);
    }
  });

  test("the head links the manifest, or none of the above happens", () => {
    const root = readFileSync(join(ROUTES, "__root.tsx"), "utf8");
    expect(root).toContain('rel: "manifest"');
    expect(root).toContain("/manifest.webmanifest");
    expect(root).toContain('rel: "apple-touch-icon"');
  });
});
