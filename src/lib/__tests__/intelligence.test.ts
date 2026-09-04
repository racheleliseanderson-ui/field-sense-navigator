import { describe, expect, test } from "bun:test";

import { readTags, readiness } from "@/lib/intelligence";
import { destinations } from "@/lib/catalog";
import { water, withNotice } from "./fixture";

/**
 * These are the two regexes that were wrong in production, so the negative
 * cases matter more than the positive ones: both bugs were a pattern that
 * matched, not one that failed to.
 */
describe("hazard tag: current", () => {
  const fires = (text: string) => readTags(withNotice(text)).hazards.has("current");

  test.each<[string, boolean]>([
    ["swift current through the canyon", true],
    ["strong current below the dam", true],
    ["heavy current at the confluence", true],
    ["tidal current on the ebb", true],
    ["reversing current in the narrows", true],
    ["cross-current at the seam", true],
    ["watch the currents near the point", true],
    ["current seam along the drop", true],
    ["current velocity is published hourly", true],
    ["flows are managed for irrigation", true],
    ["rapids below the takeout", true],
    ["whitewater section, class III", true],
    ["dam release schedule changes weekly", true],
    ["discharge is measured at the gauge", true],
    ["swift water rescue signage posted", true],
    // The bug: "current" as an adjective is ordinary agency prose and fired
    // a current-and-flow hazard on every record in the catalog.
    ["check the current rules before you go", false],
    ["a current registration is required", false],
    ["status: current_with_agency_review", false],
    ["the current fee schedule applies", false],
    ["current conditions are posted at the kiosk", false],
    ["consult the current regulations booklet", false],
  ])("%j -> %s", (text, expected) => {
    expect(fires(text)).toBe(expected);
  });
});

describe("hazard tag: tide", () => {
  const fires = (text: string) => readTags(withNotice(text)).hazards.has("tide");

  test.each<[string, boolean]>([
    ["fish the outgoing tide", true],
    ["tides run four feet here", true],
    ["tidewater reach below the bridge", true],
    ["tidal influence extends to the weir", true],
    // The bug: a place name, and the provincial licensing boilerplate, put a
    // tide hazard on inland rivers and on every Canadian record.
    ["Plese Flats put-in, gravel", false],
    ["park at the flats and walk upstream", false],
    ["any tidal or federal licence requirements are separate", false],
    ["tidal licence requirements are separate", false],
  ])("%j -> %s", (text, expected) => {
    expect(fires(text)).toBe(expected);
  });
});

describe("other hazard tags", () => {
  test.each<[string, string, boolean]>([
    ["ice", "ice shelves form by December", true],
    ["ice", "service is available", false],
    ["algae", "blue-green algae advisory in effect", true],
    ["wind", "small craft advisory on the open fetch", true],
    ["level", "drawdown exposes unmarked stumps", true],
    ["fire", "fire restrictions are in force", true],
    ["remote", "no cell coverage beyond the trailhead", true],
    ["fog", "fog closes visibility most mornings", true],
  ])("%s on %j -> %s", (tag, text, expected) => {
    expect(readTags(withNotice(text)).hazards.has(tag)).toBe(expected);
  });
});

describe("crowd and seasonal tags", () => {
  test("permit fires on a fee, a reservation or a permit", () => {
    for (const text of ["day-use fee applies", "reservation required", "permit required"]) {
      expect(readTags(withNotice(text)).crowd.has("permit")).toBe(true);
    }
  });
  test("ais fires on clean-drain-dry language", () => {
    expect(readTags(withNotice("clean-drain-dry inspection at the ramp")).seasonal.has("ais")).toBe(
      true,
    );
  });
  test("a record with no prose carries no tags at all", () => {
    const t = readTags(water());
    expect([...t.hazards, ...t.crowd, ...t.seasonal]).toEqual([]);
  });
});

describe("launch and shore detection", () => {
  test("an open boat launch reads as an open launch", () => {
    const t = readTags(water({ publicAccess: [{ name: "North Ramp", type: "boat_launch" }] }));
    expect(t.hasOpenLaunch).toBe(true);
    expect(t.hasClosedLaunch).toBe(false);
  });
  test("a closed ramp reads as closed, not open", () => {
    const t = readTags(
      water({ publicAccess: [{ name: "North Ramp", type: "boat_launch", status: "closed" }] }),
    );
    expect(t.hasClosedLaunch).toBe(true);
    expect(t.hasOpenLaunch).toBe(false);
  });
  test("a directory-only record is marked as such", () => {
    const t = readTags(
      water({ publicAccess: [{ name: "Access finder", type: "multiple_official_access_sites" }] }),
    );
    expect(t.directoryOnly).toBe(true);
  });
  test("a carry-in site is a hand launch, not a trailer launch", () => {
    const t = readTags(water({ publicAccess: [{ name: "Canoe carry-in", type: "hand_launch" }] }));
    expect(t.hasHandLaunch).toBe(true);
    expect(t.hasOpenLaunch).toBe(false);
  });
});

describe("readiness", () => {
  test("score stays inside its own parts", () => {
    for (const d of destinations.slice(0, 60)) {
      const r = readiness(d);
      const max = r.parts.reduce((n, p) => n + p.max, 0);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(max);
      expect(r.parts.every((p) => p.value >= 0 && p.value <= p.max)).toBe(true);
    }
  });
  test("every record lands in a known band and grade", () => {
    const bands = new Set(["Ready to plan", "Plan with checks", "Plan carefully", "Constrained"]);
    const grades = new Set(["clear", "watch", "flagged", "restricted"]);
    for (const d of destinations) {
      const r = readiness(d);
      expect(bands.has(r.band)).toBe(true);
      expect(grades.has(r.grade)).toBe(true);
    }
  });
});
