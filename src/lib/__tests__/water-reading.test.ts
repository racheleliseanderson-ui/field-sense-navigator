import { describe, expect, test } from "bun:test";

import { readWater, cuesFor, type ReadLevel } from "@/lib/water-reading";
import type { WaterType } from "@/lib/catalog";
import { destinations } from "@/lib/catalog";
import { water } from "./fixture";

const LEVELS: ReadLevel[] = ["learning", "working", "advanced"];

describe("readWater", () => {
  test.each<WaterType[]>([["river"], ["lake"], ["reservoir"], ["marine"]])(
    "a %s reads as its own class",
    (waterType) => {
      const r = readWater(water({ waterType }));
      expect(r.waterClass).toBe(waterType);
      expect(r.headline.length).toBeGreaterThan(0);
    },
  );

  test("every record in the catalog produces a headline and a class", () => {
    for (const d of destinations) {
      const r = readWater(d);
      expect(r.headline.trim().length).toBeGreaterThan(0);
      expect(r.waterClass).toBe(d.waterType);
    }
  });
});

describe("cuesFor", () => {
  test("each level returns cues, and no cue is empty", () => {
    const r = readWater(water());
    for (const level of LEVELS) {
      const cues = cuesFor(r, level);
      expect(cues.length).toBeGreaterThan(0);
      for (const c of cues) {
        expect(c.title.trim().length).toBeGreaterThan(0);
        expect(c.what.trim().length).toBeGreaterThan(0);
        expect(c.why.trim().length).toBeGreaterThan(0);
        expect(c.look.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("a deeper level never hides what a shallower one showed", () => {
    const r = readWater(water());
    const ids = (level: ReadLevel) => new Set(cuesFor(r, level).map((c) => c.title));
    const learning = ids("learning");
    const working = ids("working");
    const advanced = ids("advanced");
    for (const t of learning) expect(working.has(t)).toBe(true);
    for (const t of working) expect(advanced.has(t)).toBe(true);
  });

  test("cues are craft, not a claim about today — no record carries a reading", () => {
    for (const d of destinations.slice(0, 40)) {
      for (const c of cuesFor(readWater(d), "advanced")) {
        expect(c.what).not.toMatch(/\b\d+(\.\d+)?\s?(cfs|ft³\/s|°[CF])\b/);
      }
    }
  });
});
