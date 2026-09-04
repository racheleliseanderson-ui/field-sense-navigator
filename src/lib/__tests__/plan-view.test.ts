import { describe, expect, test } from "bun:test";

import {
  ALL_SCHEMATICS,
  DEFAULT_PLAN_STATE,
  WIND_POINTS,
  bearingDelta,
  planSummary,
  readPlan,
  readZone,
  schematicFor,
  windLoad,
  zonesFor,
  type PlanSchematic,
  type PlanZone,
} from "@/lib/plan-view";

/**
 * The plan view is the first drawing in this app that *moves*. That makes it
 * the first drawing that can lie, because a diagram which rearranges itself
 * is making a claim, and a claim with no sentence attached is a magic trick.
 *
 * So the tests here guard four things:
 *
 *   1. The wind maths is actually geometry. A north wind must light the shore
 *      that faces north and quieten the one that faces south, and it must do
 *      that for all eight points, not just the one that got eyeballed.
 *   2. Precedence is fixed: dry ground stays dry. A water state that switched
 *      a zone off cannot be switched back on by a breeze.
 *   3. Nothing anywhere in the copy predicts a fish.
 *   4. Every zone that changes under a state says why, in words.
 */

function zone(over: Partial<PlanZone> & { id: string }): PlanZone {
  return {
    label: "Test zone",
    what: "what",
    why: "why",
    look: "look",
    level: "learning",
    at: { x: 0.5, y: 0.5 },
    ...over,
  };
}

describe("bearing maths", () => {
  test("the delta is the short way round", () => {
    expect(bearingDelta(0, 10)).toBe(10);
    expect(bearingDelta(10, 0)).toBe(10);
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(0, 180)).toBe(180);
    expect(bearingDelta(0, 190)).toBe(170);
  });
});

describe("wind load", () => {
  const shore = zone({ id: "s", facing: 0, exposure: 1 });

  test("wind from the direction the shore faces is full on", () => {
    expect(windLoad(shore, "N")).toBeCloseTo(1, 5);
  });

  test("wind from the opposite side is full off", () => {
    expect(windLoad(shore, "S")).toBeCloseTo(-1, 5);
  });

  test("wind along the shore is neither", () => {
    expect(windLoad(shore, "E")).toBeCloseTo(0, 5);
    expect(windLoad(shore, "W")).toBeCloseTo(0, 5);
  });

  test("a sheltered shore feels the same wind less", () => {
    const sheltered = zone({ id: "b", facing: 0, exposure: 0.2 });
    expect(windLoad(sheltered, "N")).toBeCloseTo(0.2, 5);
  });

  test("a feature that is not a piece of shore has no wind answer at all", () => {
    expect(windLoad(zone({ id: "h" }), "N")).toBeNull();
  });

  test("no wind set means no wind answer, for every zone", () => {
    for (const schematic of ALL_SCHEMATICS) {
      for (const z of schematic.zones) {
        expect(windLoad(z, null)).toBeNull();
      }
    }
  });
});

describe("the good bank moves with the wind", () => {
  const lake = schematicFor("lake");
  const north = lake.zones.find((z) => z.id === "north-shore")!;
  const south = lake.zones.find((z) => z.id === "south-shore")!;

  test("a north wind lifts the north-facing shore and quietens the other", () => {
    const state = { ...DEFAULT_PLAN_STATE, wind: "N" as const };
    /* The north shore faces south across the basin, so a north wind is off it. */
    expect(readZone(north, state).emphasis).toBe("quiet");
    expect(readZone(south, state).emphasis).toBe("strong");
  });

  test("swinging the wind swaps them", () => {
    const state = { ...DEFAULT_PLAN_STATE, wind: "S" as const };
    expect(readZone(north, state).emphasis).toBe("strong");
    expect(readZone(south, state).emphasis).toBe("quiet");
  });

  test("a wind blowing along the basin moves neither", () => {
    const state = { ...DEFAULT_PLAN_STATE, wind: "E" as const };
    expect(readZone(north, state).emphasis).toBe("normal");
    expect(readZone(south, state).emphasis).toBe("normal");
  });

  test("every wind point produces exactly one windward and one leeward of the pair", () => {
    for (const point of WIND_POINTS) {
      const state = { ...DEFAULT_PLAN_STATE, wind: point };
      const n = readZone(north, state).emphasis;
      const s = readZone(south, state).emphasis;
      /* Opposing shores can both be neutral on a cross wind, but they can
         never both be strong — that would be a drawing telling two stories. */
      expect(n === "strong" && s === "strong").toBe(false);
      expect(n === "quiet" && s === "quiet").toBe(false);
    }
  });
});

describe("dry ground stays dry", () => {
  const reservoir = schematicFor("reservoir");
  const flat = reservoir.zones.find((z) => z.id === "flat")!;

  test("a drawdown switches the flat off", () => {
    const read = readZone(flat, { ...DEFAULT_PLAN_STATE, water: "drawdown" });
    expect(read.emphasis).toBe("off");
    expect(read.notes[0]).toContain("Dry");
  });

  test("no wind direction can bring it back", () => {
    for (const point of WIND_POINTS) {
      const read = readZone(flat, { wind: point, water: "drawdown", tide: null });
      expect(read.emphasis).toBe("off");
    }
  });

  test("rising water is what brings it back, and it says why", () => {
    const read = readZone(flat, { ...DEFAULT_PLAN_STATE, water: "rising" });
    expect(read.emphasis).toBe("strong");
    expect(read.notes.join(" ")).toContain("freshly flooded");
  });
});

describe("tide", () => {
  const coast = schematicFor("marine");
  const flat = coast.zones.find((z) => z.id === "flat")!;
  const rip = coast.zones.find((z) => z.id === "rip")!;

  test("a tidal flat is out of play at low water", () => {
    expect(readZone(flat, { wind: null, water: "settled", tide: "low" }).emphasis).toBe("off");
  });

  test("the rip works hardest on the ebb and stops at slack", () => {
    expect(readZone(rip, { wind: null, water: "settled", tide: "ebb" }).emphasis).toBe("strong");
    expect(readZone(rip, { wind: null, water: "settled", tide: "high" }).emphasis).toBe("quiet");
  });

  test("no tide set leaves the coast unmodified", () => {
    expect(readZone(rip, DEFAULT_PLAN_STATE).emphasis).toBe("normal");
  });
});

describe("levels", () => {
  test("a learning reader gets fewer zones than an advanced one, on every schematic", () => {
    for (const schematic of ALL_SCHEMATICS) {
      const learning = zonesFor(schematic, "learning").length;
      const advanced = zonesFor(schematic, "advanced").length;
      expect(learning).toBeGreaterThan(0);
      expect(advanced).toBeGreaterThanOrEqual(learning);
      expect(advanced).toBe(schematic.zones.length);
    }
  });
});

describe("the summary explains the drawing rather than decorating it", () => {
  test("a state that changes nothing says so", () => {
    const river = schematicFor("river");
    const reads = readPlan(river, "learning", DEFAULT_PLAN_STATE);
    const summary = planSummary(reads, DEFAULT_PLAN_STATE);
    expect(summary).toContain("Set a wind, a water state or a tide");
  });

  test("zones that are off are named as out of play", () => {
    const reservoir = schematicFor("reservoir");
    const state = { ...DEFAULT_PLAN_STATE, water: "drawdown" as const };
    const summary = planSummary(readPlan(reservoir, "advanced", state), state);
    expect(summary).toContain("Out of play");
    expect(summary.toLowerCase()).toContain("shallow flat");
  });
});

describe("nothing in here predicts a fish", () => {
  const banned =
    /\bfish will\b|\byou will catch\b|\bguarantee\b|\bhot spot\b|\bhotspot\b|\bthe fish are\b/i;

  function everyString(schematic: PlanSchematic): string[] {
    const out = [schematic.title, schematic.caption];
    for (const z of schematic.zones) {
      out.push(z.label, z.what, z.why, z.look);
      for (const entry of Object.values(z.water ?? {})) out.push(entry.note);
      for (const entry of Object.values(z.tide ?? {})) out.push(entry.note);
    }
    return out;
  }

  test("no schematic promises anything", () => {
    for (const schematic of ALL_SCHEMATICS) {
      for (const line of everyString(schematic)) {
        expect(line).not.toMatch(banned);
      }
    }
  });

  test("every zone says what it is, why, and how to find it", () => {
    for (const schematic of ALL_SCHEMATICS) {
      for (const z of schematic.zones) {
        expect(z.what.length).toBeGreaterThan(20);
        expect(z.why.length).toBeGreaterThan(20);
        expect(z.look.length).toBeGreaterThan(15);
      }
    }
  });

  test("every state entry carries a reason, never a bare emphasis", () => {
    for (const schematic of ALL_SCHEMATICS) {
      for (const z of schematic.zones) {
        for (const entry of Object.values(z.water ?? {})) {
          expect(entry.note.trim().length).toBeGreaterThan(15);
        }
        for (const entry of Object.values(z.tide ?? {})) {
          expect(entry.note.trim().length).toBeGreaterThan(15);
        }
      }
    }
  });

  test("a schematic only advertises water states it actually models", () => {
    for (const schematic of ALL_SCHEMATICS) {
      const modelled = new Set<string>();
      for (const z of schematic.zones) {
        for (const key of Object.keys(z.water ?? {})) modelled.add(key);
      }
      for (const key of modelled) {
        expect(schematic.states).toContain(key as (typeof schematic.states)[number]);
      }
    }
  });

  test("the tide control is only offered where zones answer to it", () => {
    for (const schematic of ALL_SCHEMATICS) {
      const hasTide = schematic.zones.some((z) => z.tide && Object.keys(z.tide).length > 0);
      expect(schematic.tideMatters).toBe(hasTide);
    }
  });

  test("the wind dial is only offered where zones face somewhere", () => {
    for (const schematic of ALL_SCHEMATICS) {
      const hasFacing = schematic.zones.some((z) => z.facing != null);
      expect(schematic.windMatters).toBe(hasFacing);
    }
  });
});
