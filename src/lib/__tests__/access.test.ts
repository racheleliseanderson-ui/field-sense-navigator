import { describe, expect, test } from "bun:test";

import { readAccess, logisticsIdsFor, LOGISTICS_FACETS } from "@/lib/access";
import { destinations } from "@/lib/catalog";
import { water } from "./fixture";

describe("readAccess", () => {
  test("a trailer ramp, a carry-in and a pier are counted separately", () => {
    const a = readAccess(
      water({
        publicAccess: [
          { name: "North Ramp", type: "boat_launch" },
          { name: "Canoe carry-in", type: "hand_launch" },
          { name: "Town Pier", type: "pier" },
        ],
      }),
    );
    expect(a.counts.trailer_launch).toBe(1);
    expect(a.counts.hand_launch).toBe(1);
    expect(a.counts.pier).toBe(1);
    expect(a.namedSites).toBe(3);
  });

  test("a directory record publishes no named sites", () => {
    const a = readAccess(
      water({ publicAccess: [{ name: "Access finder", type: "multiple_official_access_sites" }] }),
    );
    expect(a.directoryOnly).toBe(true);
  });

  test("a record with no published access has nothing to report", () => {
    const a = readAccess(water());
    expect(a.namedSites).toBe(0);
    expect(a.sites).toEqual([]);
    expect(a.logistics).toEqual([]);
  });
});

describe("logistics facets", () => {
  test("amenities become facets, and only published ones", () => {
    const d = water({
      // logisticsIdsFor memoizes by record id, so each fixture needs its own.
      id: "HHI-DEST-TEST-AMENITIES",
      publicAccess: [{ name: "North Ramp", type: "boat_launch", amenities: ["restroom", "parking"] }],
    });
    const ids = logisticsIdsFor(d);
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) {
      expect(LOGISTICS_FACETS.some((f) => f.id === id)).toBe(true);
    }
  });

  test("no amenities means no facets — nothing is assumed", () => {
    expect(
      logisticsIdsFor(
        water({ id: "HHI-DEST-TEST-BARE", publicAccess: [{ name: "X", type: "shore" }] }),
      ).size,
    ).toBe(0);
  });

  test("every facet the catalog produces is a declared facet", () => {
    const declared = new Set(LOGISTICS_FACETS.map((f) => f.id));
    for (const d of destinations) {
      for (const id of logisticsIdsFor(d)) expect(declared.has(id)).toBe(true);
    }
  });
});
