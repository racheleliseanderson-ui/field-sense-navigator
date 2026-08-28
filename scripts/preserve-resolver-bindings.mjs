#!/usr/bin/env node
/**
 * Prevent a transient official-index outage from erasing a previously verified
 * exact station binding. This never creates a new binding and never substitutes
 * a nearby gauge: it may only retain the prior agency + siteId for the same
 * destination when the new resolver row explicitly reports an upstream index
 * availability failure.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const priorPath = resolve(process.argv[2] ?? ".resolver-station-bindings-prior.json");
const nextPath = resolve(process.argv[3] ?? "src/data/station-bindings.json");

const prior = JSON.parse(readFileSync(priorPath, "utf8"));
const next = JSON.parse(readFileSync(nextPath, "utf8"));
const priorById = new Map((prior.records ?? []).map((row) => [row.destinationId, row]));

const outageNote = /could not be reached|index could not|temporar(?:y|ily)|unavailable|upstream/i;
let retained = 0;

next.records = (next.records ?? []).map((row) => {
  const before = priorById.get(row.destinationId);
  const outageState = row.status === "error" || row.status === "unsupported";
  if (
    !outageState ||
    !outageNote.test(String(row.note ?? "")) ||
    before?.status !== "matched" ||
    !before.siteId ||
    !before.agency
  ) {
    return row;
  }

  retained += 1;
  return {
    ...row,
    status: "matched",
    agency: before.agency,
    siteId: before.siteId,
    siteName: before.siteName,
    score: before.score,
    source: before.source,
    lat: row.lat ?? before.lat ?? null,
    lon: row.lon ?? before.lon ?? null,
    nwsStationId: row.nwsStationId ?? before.nwsStationId ?? null,
    nwsStationName: row.nwsStationName ?? before.nwsStationName ?? null,
    note: `${before.note ?? "Previously verified exact official binding."} Retained from the prior verified binding because this resolver run reported an upstream index outage: ${row.note}`,
  };
});

const counts = {
  matched: 0,
  unmatched: 0,
  unsupported: 0,
  error: 0,
};
const byAgency = {};
let overrides = 0;
for (const row of next.records) {
  if (Object.hasOwn(counts, row.status)) counts[row.status] += 1;
  if (row.status === "matched" && row.agency) {
    byAgency[row.agency] = (byAgency[row.agency] ?? 0) + 1;
  }
  if (row.source === "override") overrides += 1;
}

next.stats = {
  ...(next.stats ?? {}),
  records: next.records.length,
  ...counts,
  overrides,
  byAgency,
};

writeFileSync(nextPath, `${JSON.stringify(next, null, 2)}\n`);
console.error(
  `resolver outage guard retained ${retained} prior exact binding${retained === 1 ? "" : "s"}; ` +
    `${counts.matched}/${next.records.length} matched`,
);
