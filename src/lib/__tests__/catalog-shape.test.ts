import { describe, expect, test } from "bun:test";

import { destinations, displayName, placeDotted, placeOf } from "@/lib/catalog";
import { search, suggest } from "@/lib/search";

/**
 * The catalogue is the shape the types say it is.
 *
 * Every field below was typed as a plain string and half the records did not
 * have one. `norm(d.region)` threw on the first of them, which took out the
 * search index and with it /explore, /compare and every other page that builds
 * it — while the typecheck, the tests and the build all passed. These fixtures
 * are the check that was missing.
 */
describe("catalogue shape", () => {
  test("every record has the string fields the type promises", () => {
    const bad: string[] = [];
    for (const d of destinations) {
      if (typeof d.id !== "string" || !d.id) bad.push(`${d.id}: id`);
      if (typeof d.state !== "string" || !d.state) bad.push(`${d.id}: state`);
      if (typeof d.waterbody !== "string" || !d.waterbody) bad.push(`${d.id}: waterbody`);
      if (typeof d.waterType !== "string") bad.push(`${d.id}: waterType`);
      // region is nullable on purpose, and must be null rather than undefined
      // or a number, so a `?? ""` is enough everywhere it is read.
      if (d.region !== null && typeof d.region !== "string") bad.push(`${d.id}: region`);
      for (const s of d.speciesContext ?? []) {
        if (typeof s !== "string") bad.push(`${d.id}: speciesContext entry`);
      }
      for (const a of d.publicAccess ?? []) {
        if (typeof a?.name !== "string" || typeof a?.type !== "string") {
          bad.push(`${d.id}: publicAccess entry`);
        }
      }
      for (const t of d.tags ?? []) {
        if (typeof t !== "string") bad.push(`${d.id}: tags entry`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  test("the search index builds over the whole catalogue", () => {
    // The crash was here and nowhere else: building the index touched a null
    // region on record 524 of 1019 and threw before any page could render.
    expect(() => search("river")).not.toThrow();
    expect(() => search("")).not.toThrow();
    expect(() => suggest("mont")).not.toThrow();
    expect(search("river").hits.length).toBeGreaterThan(0);
  });

  test("a record with no region prints its state rather than the word null", () => {
    const placeless = destinations.find((d) => d.region === null);
    if (!placeless) return; // fine — the catalogue simply has a region for all of them
    expect(placeOf(placeless)).toBe(placeless.state);
    expect(placeDotted(placeless)).toBe(placeless.state);
    expect(placeOf(placeless)).not.toContain("null");
    expect(placeDotted(placeless)).not.toContain("·");
  });

  test("a record with a region still prints both parts", () => {
    const placed = destinations.find((d) => typeof d.region === "string" && d.region.length > 0);
    expect(placed).toBeDefined();
    if (!placed) return;
    expect(placeOf(placed)).toBe(`${placed.region}, ${placed.state}`);
    expect(placeDotted(placed)).toBe(`${placed.region} · ${placed.state}`);
  });

  test("every record has a display name", () => {
    const empty = destinations.filter((d) => !displayName(d).trim());
    expect(empty.map((d) => d.id)).toEqual([]);
  });
});
