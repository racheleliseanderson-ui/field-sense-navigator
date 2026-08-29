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
  applyObservationAge,
} from "./ingest-live.lib.mjs";

const NOW = Date.parse("2026-08-19T22:30:00Z");
const FRESH = "2026-08-19T21:15:00Z";

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
      readings: [
        {
          label: "Reservoir elevation",
          value: "6024.1",
          unit: "ft",
          observedAt: "2026-08-18T00:00:00Z",
        },
      ],
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
  const out = carryForward(prev, next, NOW);
  assert.equal(out["rise:341"].carriedForward, true);
  assert.equal(out["rise:341"].readings[0].value, "6024.1");
  assert.equal(out["rise:341"].readings[0].observedAt, "2026-08-18T00:00:00Z");
  assert.match(out["rise:341"].error, /last agency observation retained/);
});

test("a fossil IV value is not treated as current; a still-fresh prior wins", () => {
  const prev = {
    "12117700": {
      siteId: "12117700",
      agency: "USGS",
      readings: [{ label: "Gage height", value: "5.12", unit: "ft", observedAt: FRESH }],
    },
  };
  const next = {
    "12117700": {
      siteId: "12117700",
      agency: "USGS",
      readings: [
        {
          label: "Streamflow",
          value: "6.00",
          unit: "ft³/s",
          observedAt: "1990-09-30T23:45:00.000-07:00",
        },
      ],
    },
  };
  const out = carryForward(prev, next, NOW);
  assert.equal(out["12117700"].readings[0].label, "Gage height");
  assert.equal(out["12117700"].readings[0].value, "5.12");
  assert.equal(out["12117700"].retainedReadings[0].value, "6.00");
  assert.equal(out["12117700"].carriedForward, true);
});

test("merge keeps stations the current pass did not fetch", () => {
  const prev = {
    A: {
      siteId: "A",
      agency: "USGS",
      readings: [{ label: "Streamflow", value: "1", unit: "ft³/s", observedAt: FRESH }],
    },
    B: {
      siteId: "B",
      agency: "USBR",
      readings: [{ label: "Reservoir elevation", value: "9", unit: "ft", observedAt: "2026-08-18T00:00:00Z" }],
    },
  };
  const next = {
    A: {
      siteId: "A",
      agency: "USGS",
      readings: [{ label: "Streamflow", value: "2", unit: "ft³/s", observedAt: FRESH }],
    },
  };
  const merged = mergeStations(prev, next, NOW);
  assert.equal(merged.A.readings[0].value, "2");
  assert.equal(merged.B.readings[0].value, "9");
});

test("mergeSnapshot rebuilds stats across the combined catalog", () => {
  const prev = {
    ingestedAt: "2026-08-19T20:00:00Z",
    cadenceMinutes: 30,
    stats: { destinationBindings: 439 },
    stations: {
      old: {
        siteId: "old",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "1", unit: "ft³/s", observedAt: FRESH }],
      },
    },
    observations: {
      KAPA: {
        stationId: "KAPA",
        readings: [{ label: "Weather", value: "clear", unit: "", observedAt: FRESH }],
      },
    },
  };
  const next = {
    schema: "0.6.0",
    source: "usgs-nwis-iv",
    doctrine: "Agency observations only.",
    stations: {
      new: {
        siteId: "new",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "3", unit: "ft³/s", observedAt: FRESH }],
      },
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

test("full merge prunes retired stations and observations but preserves omitted slow stations", () => {
  const prev = {
    stats: { destinationBindings: 2 },
    stations: {
      A: {
        siteId: "A",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "1", unit: "ft³/s", observedAt: FRESH }],
      },
      retired: {
        siteId: "retired",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "8", unit: "ft³/s", observedAt: FRESH }],
      },
      B: {
        siteId: "B",
        agency: "USBR",
        readings: [
          {
            label: "Reservoir elevation",
            value: "9",
            unit: "ft",
            observedAt: "2026-08-18T00:00:00Z",
          },
        ],
      },
    },
    observations: {
      KNEW: {
        stationId: "KNEW",
        readings: [{ label: "Weather", value: "clear", unit: "", observedAt: FRESH }],
      },
      KOLD: {
        stationId: "KOLD",
        readings: [{ label: "Weather", value: "clear", unit: "", observedAt: FRESH }],
      },
    },
  };
  const next = {
    schema: "0.6.0",
    stations: {
      A: {
        siteId: "A",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "2", unit: "ft³/s", observedAt: FRESH }],
      },
    },
    observations: {
      KNEW: {
        stationId: "KNEW",
        readings: [{ label: "Weather", value: "clear", unit: "", observedAt: FRESH }],
      },
    },
    stats: { destinationBindings: 2 },
  };
  const snap = mergeSnapshot(prev, next, {
    ingestedAt: "2026-08-19T21:10:00Z",
    cadenceMinutes: 30,
    mode: "all",
  });
  assert.deepEqual(Object.keys(snap.stations).sort(), ["A", "B"]);
  assert.deepEqual(Object.keys(snap.observations), ["KNEW"]);
  assert.equal(snap.stats.boundStations, 2);
  assert.equal(snap.stats.nwsStations, 1);
});

test("slow merge prunes retired slow stations without dropping fast agencies", () => {
  const prev = {
    stats: { destinationBindings: 2 },
    stations: {
      A: {
        siteId: "A",
        agency: "USGS",
        readings: [{ label: "Streamflow", value: "1", unit: "ft³/s", observedAt: FRESH }],
      },
      OLD: {
        siteId: "OLD",
        agency: "USBR",
        readings: [
          {
            label: "Reservoir elevation",
            value: "7",
            unit: "ft",
            observedAt: "2026-08-18T00:00:00Z",
          },
        ],
      },
      B: {
        siteId: "B",
        agency: "USBR",
        readings: [
          {
            label: "Reservoir elevation",
            value: "9",
            unit: "ft",
            observedAt: "2026-08-18T00:00:00Z",
          },
        ],
      },
    },
    observations: {},
  };
  const next = {
    schema: "0.6.0",
    stations: {
      B: {
        siteId: "B",
        agency: "USBR",
        readings: [
          {
            label: "Reservoir elevation",
            value: "10",
            unit: "ft",
            observedAt: "2026-08-19T00:00:00Z",
          },
        ],
      },
    },
    observations: {},
    stats: { destinationBindings: 2 },
  };
  const snap = mergeSnapshot(prev, next, {
    ingestedAt: "2026-08-19T21:10:00Z",
    cadenceMinutes: 30,
    mode: "slow",
  });
  assert.deepEqual(Object.keys(snap.stations).sort(), ["A", "B"]);
  assert.equal(snap.stations.B.readings[0].value, "10");
  assert.equal(snap.stats.boundStations, 2);
});

test("rebuildStats counts only current observations; fossils are stale-only", () => {
  const stations = {
    BNK: {
      siteId: "BNK",
      agency: "USBR",
      readings: [{ label: "Reservoir elevation", value: "1566", unit: "ft", observedAt: "2026-08-18T00:00:00Z" }],
    },
    "rise:341": {
      siteId: "rise:341",
      agency: "USBR",
      readings: [],
      error: "The operation was aborted due to timeout",
    },
    fossil: applyObservationAge(
      {
        siteId: "12117700",
        agency: "USGS",
        readings: [
          {
            label: "Streamflow",
            value: "6.00",
            unit: "ft³/s",
            observedAt: "1990-09-30T23:45:00.000-07:00",
          },
        ],
      },
      NOW,
    ),
  };
  const stats = rebuildStats(stations, {}, 2);
  assert.equal(stats.byAgency.USBR.bound, 2);
  assert.equal(stats.byAgency.USBR.withReadings, 1);
  assert.equal(stats.byAgency.USGS.withReadings, 0);
  assert.equal(stats.withStaleOnly, 1);
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
});

test("shouldNotify skips carry-forward-only degrades and fires on hard misses", () => {
  assert.equal(shouldNotify(null), false);
  assert.equal(shouldNotify({ hardErrorCount: 0, degraded: true }), false);
  assert.equal(shouldNotify({ hardErrorCount: 2, degraded: true }), true);
  assert.equal(shouldNotify({ hardErrorCount: 0 }, { failed: true }), true);
});

test("a fossil IV miss does not page — it is printed, not a hard error", () => {
  const fossil = applyObservationAge(
    {
      siteId: "14056500",
      agency: "USGS",
      readings: [
        {
          label: "Streamflow",
          value: "448",
          unit: "ft³/s",
          observedAt: "1991-09-30T23:30:00.000-07:00",
        },
      ],
    },
    NOW,
  );
  const errors = collectErrors({ "14056500": fossil }, {});
  const status = buildStatus({
    payload: {
      ingestedAt: "now",
      cadenceMinutes: 30,
      stats: rebuildStats({ "14056500": fossil }, {}, 1),
      doctrine: "x",
    },
    opts: { mode: "all", onlySlow: false },
    errors,
  });
  assert.equal(status.degraded, true);
  assert.equal(status.hardErrorCount, 0);
  assert.equal(shouldNotify(status), false);
});
