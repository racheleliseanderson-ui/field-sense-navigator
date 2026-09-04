/**
 * Write public/sitemap.xml from the assembled catalog.
 *
 * The index page and the catalog are the entry points; every named water is
 * its own document and carries its own lastmod, taken from the date the
 * official source was last read. Tool surfaces whose state lives in the
 * browser (compare, plan, watchlist) and derived views of a record
 * (the printable briefs) are declared noindex in the route heads and are
 * deliberately absent here — a sitemap that disagrees with the pages it
 * lists is worse than no sitemap.
 *
 * Run from prebuild so a deploy can never ship a sitemap that is older than
 * the catalog it describes.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://waterways.hookthehorizon.blog";
const out = join(root, "public/sitemap.xml");

function readArray(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data)) throw new Error(`${path} must contain a JSON array`);
  return data;
}

const shardDir = join(root, "src/data/destinations");
const records = [
  ...readArray(join(root, "src/data/destinations.json")),
  ...(existsSync(shardDir)
    ? readdirSync(shardDir)
        .filter((n) => n.endsWith(".json"))
        .sort()
        .flatMap((n) => readArray(join(shardDir, n)))
    : []),
];

if (records.length < 500) {
  console.error(`build-sitemap: refusing to publish a sitemap for ${records.length} records`);
  process.exit(1);
}

/** An ISO date, or null. A bad date is omitted rather than guessed. */
function day(value) {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const esc = (s) =>
  String(s).replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );

const newest =
  records
    .map((d) => day(d.checkedAt))
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString().slice(0, 10);

const entries = [
  { loc: `${SITE}/`, lastmod: newest, changefreq: "daily", priority: "1.0" },
  { loc: `${SITE}/explore`, lastmod: newest, changefreq: "daily", priority: "0.9" },
  // The reading school is craft rather than catalogue: it does not change when
  // a record is refreshed, and it is the page most likely to be useful to
  // somebody who has never heard of any water we hold.
  { loc: `${SITE}/reading`, changefreq: "monthly", priority: "0.7" },
  { loc: `${SITE}/pipeline`, lastmod: newest, changefreq: "daily", priority: "0.5" },
  { loc: `${SITE}/boundary`, lastmod: newest, changefreq: "monthly", priority: "0.4" },
];

const seen = new Set();
for (const d of records) {
  if (!d || typeof d.id !== "string" || seen.has(d.id)) continue;
  seen.add(d.id);
  const lastmod = day(d.checkedAt);
  entries.push({
    loc: `${SITE}/water/${encodeURIComponent(d.id)}`,
    ...(lastmod ? { lastmod } : {}),
    changefreq: "weekly",
    priority: "0.8",
  });
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${esc(e.loc)}</loc>\n` +
        (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : "") +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority}</priority>\n` +
        `  </url>\n`,
    )
    .join("") +
  `</urlset>\n`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, xml, "utf8");
console.log(`build-sitemap: ok (${entries.length} urls, newest lastmod ${newest})`);
