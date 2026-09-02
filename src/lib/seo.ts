import type React from "react";

/**
 * Canonical identity for every page.
 *
 * A single canonical declared once in the root told search engines that all
 * 523 water records, the catalog and every tool page were the same document
 * as the home page — so the records that carry the actual value of this
 * instrument asked to be dropped from the index. Canonical is per page, and
 * it is declared here so there is exactly one place that decides it.
 *
 * Query strings are deliberately excluded. A facet combination on /explore
 * is a view of the catalog, not a separate document; pointing every filtered
 * view at the bare path collapses an unbounded crawl space into one page.
 */
export const SITE_URL = "https://waterways.hookthehorizon.blog";

/** Absolute URL for a site-relative path. Always without a query string. */
export function absoluteUrl(path: string): string {
  const clean = `/${String(path).replace(/^\/+/, "").split(/[?#]/)[0] ?? ""}`;
  return clean === "/" ? `${SITE_URL}/` : `${SITE_URL}${clean.replace(/\/+$/, "")}`;
}

export interface PageIdentity {
  /** The path this page should be indexed under. */
  path: string;
  /**
   * Pages that hold no unique, crawlable content of their own: tool surfaces
   * whose state lives in the browser, and derived views of a record that is
   * already indexed. They stay followable so link equity still reaches the
   * water records they point at.
   */
  noindex?: boolean;
  /**
   * A derived view points its canonical at the page it was derived from —
   * a printable brief is the same document as the record it prints.
   */
  canonicalPath?: string;
}

type MetaTag = React.DetailedHTMLProps<React.MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
type LinkTag = React.DetailedHTMLProps<React.LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;

/**
 * Merge a page's own head tags with its canonical identity.
 *
 * Every route head goes through this, so no page can ship without a
 * canonical, and adding one later cannot silently miss a route.
 */
export function withIdentity(
  identity: PageIdentity,
  head: { meta?: MetaTag[]; links?: LinkTag[] } = {},
) {
  const canonical = absoluteUrl(identity.canonicalPath ?? identity.path);
  return {
    ...head,
    meta: [
      ...(head.meta ?? []),
      { property: "og:url", content: canonical },
      {
        name: "robots",
        content: identity.noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
      },
    ],
    links: [...(head.links ?? []), { rel: "canonical", href: canonical }],
  };
}
