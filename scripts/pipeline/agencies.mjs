#!/usr/bin/env node
/**
 * Host -> managing agency, learned from the catalog rather than declared here.
 *
 * scripts/enrich-catalog.mjs already carries a hand-maintained host->agency
 * map. Copying it would give this pipeline a second implementation that drifts
 * within a month, which AGENTS.project.md warns about by name. So instead the
 * mapping is derived from the records that already exist: whatever agency the
 * human-reviewed catalog most often attributes to a host IS that host's agency
 * as far as seeding is concerned.
 *
 * A host with fewer than MIN_SUPPORT attributions, or no clear majority,
 * yields nothing -- the seeded record simply carries a null agency and a human
 * fills it in. Guessing an agency is exactly the invented provenance the
 * doctrine forbids.
 */
import { readCatalog, hostOf } from "./lib.mjs";

const MIN_SUPPORT = 2;
const MAJORITY = 0.6;

function tally(map, key, value) {
  if (!key || !value) return;
  const bucket = map.get(key) ?? new Map();
  bucket.set(value, (bucket.get(value) ?? 0) + 1);
  map.set(key, bucket);
}

function winner(bucket) {
  if (!bucket) return null;
  let total = 0;
  let best = null;
  let bestN = 0;
  for (const [value, n] of bucket) {
    total += n;
    if (n > bestN) {
      best = value;
      bestN = n;
    }
  }
  if (total < MIN_SUPPORT) return null;
  return bestN / total >= MAJORITY ? best : null;
}

let cache = null;

/** @returns {{agencyFor(url:string):string|null, regsFor(url:string):string|null, speciesVocabulary:string[], hosts:Set<string>}} */
export function agencyIndex() {
  if (cache) return cache;

  const records = readCatalog();
  const agencyByHost = new Map();
  const regsByHost = new Map();
  const species = new Map();

  for (const r of records) {
    const host = hostOf(r.officialSourceUrl);
    tally(agencyByHost, host, r.managingAgency);
    tally(regsByHost, host, r.officialRegsUrl);
    for (const s of r.speciesContext ?? []) {
      const name = String(s).trim();
      if (name) species.set(name.toLowerCase(), name);
    }
  }

  const agency = new Map();
  const regs = new Map();
  for (const [host, bucket] of agencyByHost) {
    const value = winner(bucket);
    if (value) agency.set(host, value);
  }
  for (const [host, bucket] of regsByHost) {
    const value = winner(bucket);
    if (value) regs.set(host, value);
  }

  cache = {
    agencyFor: (url) => agency.get(hostOf(url)) ?? null,
    regsFor: (url) => regs.get(hostOf(url)) ?? null,
    speciesVocabulary: [...species.values()].sort((a, b) => b.length - a.length),
    hosts: new Set([...agencyByHost.keys()].filter(Boolean)),
  };
  return cache;
}
