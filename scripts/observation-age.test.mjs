import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIVE_FRESH_MS,
  DAILY_FRESH_MS,
  STALE_WINDOW_NOTE,
  freshnessKind,
  freshnessWindowMs,
  classifyReading,
  partitionReadings,
  applyObservationAge,
} from "./observation-age.mjs";

const NOW = Date.parse("2026-08-19T22:30:00Z");

test("stage and flow use 48 hours; reservoir elevation uses 7 days", () => {
  assert.equal(freshnessKind("Streamflow"), "live");
  assert.equal(freshnessKind("Gage height"), "live");
  assert.equal(freshnessKind("Water level (MLLW)"), "live");
  assert.equal(freshnessKind("Wind"), "live");
  assert.equal(freshnessKind("Water temperature"), "live");
  assert.equal(freshnessKind("Reservoir elevation"), "daily");
  assert.equal(freshnessKind("Lake or reservoir elevation"), "daily");
  assert.equal(freshnessKind("Reservoir storage"), "daily");
  assert.equal(freshnessKind("Reservoir stage"), "daily");
  assert.equal(freshnessWindowMs("Streamflow"), LIVE_FRESH_MS);
  assert.equal(freshnessWindowMs("Reservoir elevation"), DAILY_FRESH_MS);
});

test("a 15-minute streamflow is current; a 1990 IV value is not", () => {
  assert.equal(
    classifyReading(
      { label: "Streamflow", observedAt: "2026-08-19T22:15:00Z" },
      NOW,
    ).freshness,
    "fresh",
  );
  assert.equal(
    classifyReading(
      {
        label: "Streamflow",
        observedAt: "1990-09-30T23:45:00.000-07:00",
      },
      NOW,
    ).freshness,
    "stale",
  );
});

test("yesterday's reservoir elevation is current; a 10-day elevation is not", () => {
  assert.equal(
    classifyReading(
      { label: "Reservoir elevation", observedAt: "2026-08-18T00:00:00Z" },
      NOW,
    ).freshness,
    "fresh",
  );
  assert.equal(
    classifyReading(
      { label: "Reservoir elevation", observedAt: "2026-08-09T00:00:00Z" },
      NOW,
    ).freshness,
    "stale",
  );
});

test("missing observedAt is a miss for the current slot", () => {
  assert.equal(
    classifyReading({ label: "Streamflow", observedAt: "" }, NOW).freshness,
    "unknown-age",
  );
  const { readings, retainedReadings } = partitionReadings(
    [{ label: "Streamflow", value: "12", unit: "ft³/s", observedAt: "" }],
    NOW,
  );
  assert.equal(readings.length, 0);
  assert.equal(retainedReadings[0].value, "12");
});

test("partition keeps only fresh values in readings", () => {
  const { readings, retainedReadings } = partitionReadings(
    [
      { label: "Gage height", value: "4.75", unit: "ft", observedAt: "2026-08-19T21:15:00-06:00" },
      { label: "Streamflow", value: "6.00", unit: "ft³/s", observedAt: "1990-09-30T23:45:00.000-07:00" },
    ],
    NOW,
  );
  assert.deepEqual(
    readings.map((r) => r.label),
    ["Gage height"],
  );
  assert.equal(retainedReadings[0].value, "6.00");
  assert.equal(retainedReadings[0].observedAt, "1990-09-30T23:45:00.000-07:00");
});

test("stale-only station keeps the official number and prints the window", () => {
  const out = applyObservationAge(
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
  );
  assert.equal(out.readings.length, 0);
  assert.equal(out.staleOnly, true);
  assert.equal(out.retainedReadings[0].value, "6.00");
  assert.match(out.error, /freshness window/);
  assert.equal(out.error, STALE_WINDOW_NOTE);
});
