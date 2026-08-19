import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  isCriticalRecord,
  selectRecords,
  cadenceFor,
  carryForward,
  mergeStations,
  mergeSnapshot,
  rebuildStats,
  collectErrors,
  buildStatus,
  shouldNotify,
} from "./ingest-live.lib.mjs";

test("parseArgs defaults to a full ingest", () => {
  assert.deepEqual(parseArgs([]), {
    mode: "all",
    skipSlow: false,
    onlySlow: false,
    merge: false,
  });
});

test("parseArgs reads critical + skip-slow + merge", () => {
  assert.deepEqual(parseArgs(["--mode=critical", "--skip-slow", "--merge"]), {
    mode: "critical",
    skipSlow: true,
    onlySlow: false,
    merge: true,
  });
});

test("only-slow forces a full-mode slow pass", () => {
  const opts = parseArgs(["--only-slow", "--mode=critical", "--skip-slow"]);
  assert.equal(opts.onlySlow, true);
  assert.equal(opts.skipSlow, false);
  assert.equal(opts.mode, "all");
});

test("critical records are interior-west, overrides, and NOAA — never USBR", () => {
  assert.equal(
    isCriticalRecord({
      status: "matched",
      siteId: "06713000",
      state: "Colorado",
      agency: "USGS",
    }),
    true,
  );
  assert.equal(
    isCriticalRecord({
      status: "matched",
      siteId: "8443970",
      state: "Massachusetts",
      agency: "NOAA-COOPS",
    }),
    true,
  );
  assert.equal(
    isCriticalRecord({
      status: "matched",
      siteId: "BNK",
      state: "Washington",
      agency: "USBR",
      source: "override",
    }),
    false,
  );
  assert.equal(
    isCriticalRecord({
      status: "matched",
      siteId: "02235000",
      state: "Florida",
      agency: "USGS",
    }),
    false,
  );
});

test("selectRecords honors critical, skip-slow, and only-slow", () => {
  const records = [
    { status: "matched", siteId: "1", state: "Colorado", agency: "USGS" },
    { status: "matched", siteId: "2", state: "Florida", agency: "USGS" },
    { status: "matched", siteId: "rise:341", state: "Wyoming", agency: "USBR" },
    { status: "unmatched", siteId: null, state: "Colorado", agency: null },
  ];
  assert.deepEqual(
    selectRecords(records, { mode: "critical", skipSlow: true, onlySlow: false }).map((r) => r.siteId),
    ["1"],
  );
  assert.deepEqual(
    selectRecords(records, { mode: "all", skipSlow: true, onlySlow: false }).map((r) => r.siteId),
    ["1", "2"],
  );
  assert.deepEqual(
    selectRecords(records, { mode: "all", skipSlow: false, onlySlow: true }).map((r) => r.siteId),
    ["rise:341"],
  );
});

test("cadence is 10 minutes for critical, 30 otherwise", () => {
  assert.equal(cadenceFor({ mode: "critical", onlySlow: false }), 10);
  assert.equal(cadenceFor({ mode: "all", onlySlow: false }), 30);
  assert.equal(cadenceFor({ mode: "all", onlySlow: true }), 30);
});

test("carry-forward keeps the last agency observation and prints the miss", () => {
  const prev = {
    "rise:341": {
      siteId: "rise:341",
      agency: "USBR",
      siteName: "Flaming Gorge",
      readings: [{ label: "Reservoir elevation", value: "6024.1", unit: "ft", observedAt: "2026-08-18T00:00:00Z" }],
    },
  };
  const next = {
    "rise:341": {
      siteId: "rise:341",
      agency: "USBR",
      siteName: "Flaming Gorge",
      readings: [],
      error: "The operation was aborted due to timeout",
    },
  };
  const out = carryForward(prev, next);
  assert.equal(out["rise:341"].carriedForward, true);
  assert.equal(out["rise:341"].readings[0].value, "6024.1");
  assert.equal(out["rise:341"].readings[0].observedAt, "2026-08-18T00:00:00Z");
  assert.match(out["rise:341"].error, /last agency observation retained/);
});

test("merge keeps stations the current pass did not fetch", () => {
  const prev = {
    A: { siteId: "A", agency: "USGS", readings: [{ value: "1" }] },
    B: { siteId: "B", agency: "USBR", readings: [{ value: "9" }] },
  };
  const next = {
    A: { siteId: "A", agency: "USGS", readings: [{ value: "2" }] },
  };
  const merged = mergeStations(prev, next);
  assert.equal(merged.A.readings[0].value, "2");
  assert.equal(merged.B.readings[0].value, "9");
});

test("mergeSnapshot rebuilds stats across the combined catalog", () => {
  const prev = {
    ingestedAt: "2026-08-19T20:00:00Z",
    cadenceMinutes: 30,
    stats: { destinationBindings: 439 },
    stations: {
      old: { siteId: "old", agency: "USGS", readings: [{ value: "1" }] },
    },
    observations: {
      KAPA: { stationId: "KAPA", readings: [{ value: "clear" }] },
    },
  };
  const next = {
    schema: "0.6.0",
    source: "usgs-nwis-iv",
    doctrine: "Agency observations only.",
    stations: {
      new: { siteId: "new", agency: "USGS", readings: [{ value: "3" }] },
    },
    observations: {},
    stats: { destinationBindings: 439 },
  };
  const snap = mergeSnapshot(prev, next, {
    ingestedAt: "2026-08-19T21:10:00Z",
    cadenceMinutes: 10,
    mode: "critical",
  });
  assert.equal(snap.cadenceMinutes, 10);
  assert.equal(snap.mode, "critical");
  assert.equal(snap.stats.boundStations, 2);
  assert.equal(snap.stats.withReadings, 2);
  assert.equal(snap.stats.nwsStations, 1);
});

test("rebuildStats and status surface USBR timeouts without inventing values", () => {
  const stations = {
    BNK: { siteId: "BNK", agency: "USBR", readings: [{ value: "1566" }] },
    "rise:341": {
      siteId: "rise:341",
      agency: "USBR",
      readings: [],
      error: "The operation was aborted due to timeout",
    },
  };
  const stats = rebuildStats(stations, {}, 2);
  assert.equal(stats.byAgency.USBR.bound, 2);
  assert.equal(stats.byAgency.USBR.withReadings, 1);
  const errors = collectErrors(stations, {});
  const status = buildStatus({
    payload: { ingestedAt: "now", cadenceMinutes: 30, stats, doctrine: "x" },
    opts: { mode: "all", onlySlow: true },
    errors,
  });
  assert.equal(status.mode, "slow");
  assert.equal(status.degraded, true);
  assert.equal(status.usbr.timeouts, 1);
  assert.equal(status.ok, true);
  assert.equal(status.hardErrorCount, 1);
});

test("shouldNotify skips carry-forward-only degrades and fires on hard misses", () => {
  assert.equal(shouldNotify(null, { failed: true }), true);
  assert.equal(shouldNotify(null, { failed: false }), false);
  assert.equal(shouldNotify({ hardErrorCount: 0, degraded: true }, { failed: false }), false);
  assert.equal(shouldNotify({ hardErrorCount: 1, degraded: true }, { failed: false }), true);
});
