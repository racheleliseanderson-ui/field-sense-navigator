import { describe, expect, test } from "bun:test";

import { SITE_URL, absoluteUrl, withIdentity } from "@/lib/seo";
import { sanitizeErrorReport } from "@/lib/errors.functions";
import { formatReport } from "@/lib/errors.server";

describe("absoluteUrl", () => {
  test.each<[string, string]>([
    ["/", `${SITE_URL}/`],
    ["", `${SITE_URL}/`],
    ["/explore", `${SITE_URL}/explore`],
    ["explore", `${SITE_URL}/explore`],
    ["/explore/", `${SITE_URL}/explore`],
    ["/water/HHI-DEST-005", `${SITE_URL}/water/HHI-DEST-005`],
    // A facet combination is a view of the catalog, not a separate document.
    ["/explore?q=trout&state=Montana", `${SITE_URL}/explore`],
    ["/explore#results", `${SITE_URL}/explore`],
  ])("%j -> %j", (input, expected) => {
    expect(absoluteUrl(input)).toBe(expected);
  });
});

describe("withIdentity", () => {
  test("an indexable page canonicalises to itself", () => {
    const h = withIdentity({ path: "/water/X" }, { meta: [{ content: "t" }] });
    expect(h.links.at(-1)).toEqual({ rel: "canonical", href: `${SITE_URL}/water/X` });
    expect(h.meta.some((m) => m["content"] === "index, follow, max-image-preview:large")).toBe(
      true,
    );
  });

  test("a derived view canonicalises to the page it was derived from", () => {
    const h = withIdentity({ path: "/packet/X", canonicalPath: "/water/X", noindex: true });
    expect(h.links.at(-1)).toEqual({ rel: "canonical", href: `${SITE_URL}/water/X` });
    expect(h.meta.some((m) => m["content"] === "noindex, follow")).toBe(true);
  });

  test("the page's own tags survive the merge", () => {
    const h = withIdentity({ path: "/" }, { meta: [{ title: "Home" }], links: [{ rel: "icon" }] });
    expect(h.meta[0]).toEqual({ title: "Home" });
    expect(h.links[0]).toEqual({ rel: "icon" });
  });

  test("exactly one canonical and one og:url are produced", () => {
    const h = withIdentity({ path: "/explore" }, { meta: [{ title: "Catalog" }] });
    expect(h.links.filter((l) => l["rel"] === "canonical").length).toBe(1);
    expect(h.meta.filter((m) => m["property"] === "og:url").length).toBe(1);
  });
});

describe("error reports carry nothing the reader typed", () => {
  test.each<[string, string]>([
    ["/explore?q=secret+honey+hole", "/explore"],
    ["/water/X#notes", "/water/X"],
    ["/plan", "/plan"],
  ])("route %j is reported as %j", (route, expected) => {
    expect(sanitizeErrorReport({ message: "boom", route }).route).toBe(expected);
  });

  test("an oversized message and stack are truncated, not dropped", () => {
    const r = sanitizeErrorReport({
      message: "x".repeat(5000),
      route: "/",
      stack: "y".repeat(50_000),
    });
    expect(r.message.length).toBe(400);
    expect(r.stack!.length).toBe(4000);
  });

  test("the log line is prefixed so a drain can filter for it", () => {
    const line = formatReport({ message: "boom", route: "/explore", boundary: "ssr" });
    expect(line.startsWith("[client-error] ")).toBe(true);
    expect(line).toContain("route=/explore");
    expect(line).toContain("boundary=ssr");
  });
});
