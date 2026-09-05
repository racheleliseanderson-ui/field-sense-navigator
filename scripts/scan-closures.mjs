#!/usr/bin/env node
/**
 * Nightly scan of each record's official agency page for closure language.
 *
 * Does not decide whether a water is closed. It reports the words the
 * agency page currently contains, or that the page could not be read.
 * "No closures" / "not closed" windows are ignored.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEST_PATH = resolve(ROOT, "src/data/destinations.json");
const OUT_PATH = resolve(ROOT, "public/live/closures.json");

const UA = "Mozilla/5.0 (compatible; HoneyHoleIntelligence/0.6; closure language scan)";
const TIMEOUT_MS = 9000;
const CONCURRENCY = 4;

const HIT =
  /\b(closed|closure|closures|temporarily closed|emergency closure|emergency rule|launch closed|ramp closed|pier closed|area closed|ice[- ]up|unsafe ice)\b/i;
const NEGATE = /\bno(?:\s+current)?\s+closures\b|\bnot closed\b|\bclosures?:\s*none\b/i;

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hitsIn(text) {
  const hits = [];
  const re = new RegExp(HIT.source, "gi");
  let m;
  while ((m = re.exec(text)) && hits.length < 6) {
    const start = Math.max(0, m.index - 80);
    const end = Math.min(text.length, m.index + m[0].length + 80);
    const snippet = text.slice(start, end).trim();
    if (NEGATE.test(snippet)) continue;
    hits.push({ term: m[0].toLowerCase(), snippet });
  }
  return hits;
}

async function readPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = res.url || url;
    if (!res.ok) {
      return {
        status: "unreachable",
        httpStatus: res.status,
        finalUrl,
        hits: [],
        note: `Agency host answered ${res.status}. Closure language left unread.`,
      };
    }
    const html = await res.text();
    const text = stripHtml(html);
    const hits = hitsIn(text);
    return {
      status: hits.length ? "hit" : "none",
      httpStatus: res.status,
      finalUrl,
      hits,
      note: hits.length
        ? "The agency page currently contains closure-related language. Read the snippet; this is not a determination that the water is closed."
        : "No closure-related language was found in the readable text of the cited page.",
    };
  } catch {
    return {
      status: "unreachable",
      httpStatus: null,
      finalUrl: url,
      hits: [],
      note: "No answer from the agency host within the timeout. Closure language left unread.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function poolMap(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
}

async function main() {
  const destinations = JSON.parse(readFileSync(DEST_PATH, "utf8"));
  const records = {};
  let n = 0;
  const results = await poolMap(destinations, CONCURRENCY, async (d) => {
    const row = await readPage(d.officialSourceUrl);
    n += 1;
    if (n % 40 === 0) console.error(`scan  ${n}/${destinations.length}`);
    return { id: d.id, url: d.officialSourceUrl, ...row };
  });
  for (const row of results) {
    records[row.id] = {
      status: row.status,
      httpStatus: row.httpStatus,
      url: row.url,
      finalUrl: row.finalUrl,
      hits: row.hits,
      note: row.note,
    };
  }
  const stats = {
    scanned: results.length,
    hit: results.filter((r) => r.status === "hit").length,
    none: results.filter((r) => r.status === "none").length,
    unreachable: results.filter((r) => r.status === "unreachable").length,
  };
  const payload = {
    schema: "0.6.0",
    scannedAt: new Date().toISOString(),
    cadence: "nightly",
    doctrine:
      "Reports agency-page language only. A hit is not a closure determination. An unreachable page is a miss.",
    stats,
    records,
  };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);
  console.error(
    `wrote ${OUT_PATH} · ${stats.hit} hit · ${stats.none} none · ${stats.unreachable} unread`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
