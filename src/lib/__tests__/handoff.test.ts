import { describe, expect, test } from "bun:test";

import {
  NO_TEMPERATURE,
  buildPacket,
  handoffUrl,
  temperatureFrom,
  toF,
  type LiveConditionsLike,
} from "@/lib/handoff";
import { destinations } from "@/lib/catalog";
import { water } from "./fixture";

const d = water({
  checkedAt: "2026-08-10T12:00:00.000Z",
  lastHumanReviewedAt: "2026-08-11T00:00:00.000Z",
  lastHumanReviewedBy: "bench",
  speciesContext: ["Brown trout"],
});

describe("provenance", () => {
  test("reviewedAt is the record's own source check, not the moment the link was pressed", () => {
    const p = buildPacket(d, "species") as never as { provenance: Array<Record<string, unknown>> };
    const today = new Date().toISOString().slice(0, 10);
    expect(p.provenance[0]!["reviewedAt"]).toBe("2026-08-10");
    expect(p.provenance[0]!["reviewedAt"]).not.toBe(today);
  });

  test("the packet's own build time is carried separately", () => {
    const p = buildPacket(d, "species") as never as {
      createdAt: string;
      provenance: Array<Record<string, unknown>>;
    };
    expect(p.provenance[0]!["builtAt"]).toBe(p.createdAt);
    expect(p.provenance[0]!["builtAt"]).not.toBe(p.provenance[0]!["reviewedAt"]);
  });

  test("a human sign-off travels when there is one", () => {
    const p = buildPacket(d, "species") as never as { provenance: Array<Record<string, unknown>> };
    expect(p.provenance[0]!["humanReviewedAt"]).toBe("2026-08-11");
    expect(p.provenance[0]!["humanReviewedBy"]).toBe("bench");
  });

  test("no live reading means no observed provenance entry", () => {
    const p = buildPacket(d, "species") as never as { provenance: unknown[] };
    expect(p.provenance.length).toBe(1);
  });
});

describe("toF", () => {
  test.each<[number, string, number]>([
    [18.3, "°C", 64.9],
    [0, "°C", 32],
    [100, "°C", 212],
    [64.9, "°F", 64.9],
    [58.6, "°F", 58.6],
  ])("%s %s -> %s F", (value, unit, expected) => {
    expect(toF(value, unit)).toBe(expected);
  });

  test("a non-finite reading converts to nothing rather than to a number", () => {
    expect(toF(Number.NaN, "°C")).toBeNull();
  });
});

const live: LiveConditionsLike = {
  station: { id: "01646500", name: "POTOMAC RIVER", agency: "USGS" },
  readings: [
    { label: "Gage height", value: "3.21", unit: "ft", observedAt: "2026-09-02T03:00:00Z" },
    { label: "Water temperature", value: "18.3", unit: "°C", observedAt: "2026-09-02T03:00:00Z" },
  ],
  retainedReadings: [],
  observation: {
    stationId: "KDCA",
    stationName: "Reagan National",
    readings: [
      { label: "Air temperature", value: "21.0", unit: "°C", observedAt: "2026-09-02T03:10:00Z" },
    ],
    retainedReadings: [],
  },
};

describe("temperatureFrom", () => {
  test("an official water temperature converts and carries its station", () => {
    const t = temperatureFrom(live);
    expect(t.waterTempF).toBe(64.9);
    expect(t.waterTempRetained).toBe(false);
    expect(t.station?.id).toBe("01646500");
  });

  test("air is kept apart from water and never substituted for it", () => {
    const t = temperatureFrom({ ...live, readings: [], retainedReadings: [] });
    expect(t.waterTempF).toBeNull();
    expect(t.airTempF).toBe(69.8);
    expect(t.station).toBeNull();
  });

  test("a reading outside the freshness window is carried, and marked as carried", () => {
    const t = temperatureFrom({
      station: { id: "9414290", name: "SF Bay", agency: "NOAA-COOPS" },
      readings: [],
      retainedReadings: [
        { label: "Water temperature", value: "58.6", unit: "°F", observedAt: "2026-08-30T12:00:00Z" },
      ],
      observation: null,
    });
    expect(t.waterTempF).toBe(58.6);
    expect(t.waterTempRetained).toBe(true);
    expect(t.waterTempObservedAt).toBe("2026-08-30T12:00:00Z");
  });

  test("nothing published is NO_TEMPERATURE, not a guess", () => {
    expect(temperatureFrom(null)).toEqual(NO_TEMPERATURE);
    expect(
      temperatureFrom({ station: null, readings: [], retainedReadings: [], observation: null }),
    ).toEqual(NO_TEMPERATURE);
  });
});

describe("conditions on the packet", () => {
  test("tempF is null and unknown when no station published one", () => {
    const p = buildPacket(d, "species") as never as { conditions: Record<string, unknown> };
    expect(p.conditions["tempF"]).toBeNull();
    expect(p.conditions["tempSource"]).toBe("unknown");
    expect(p.conditions["airTempF"]).toBeNull();
  });

  test("a real reading arrives as an official gauge value with its own provenance", () => {
    const p = buildPacket(d, "species", { temperature: temperatureFrom(live) }) as never as {
      conditions: Record<string, unknown>;
      provenance: Array<Record<string, unknown>>;
    };
    expect(p.conditions["tempF"]).toBe(64.9);
    expect(p.conditions["tempSource"]).toBe("official-gauge");
    expect(p.conditions["airTempSource"]).toBe("official-observation");
    expect(p.provenance.length).toBe(3);
    expect(p.provenance[1]!["evidenceClass"]).toBe("observed");
  });

  test("a carried-forward reading is labelled as retained in provenance", () => {
    const t = temperatureFrom({
      station: { id: "9414290", name: "SF Bay", agency: "NOAA-COOPS" },
      readings: [],
      retainedReadings: [
        { label: "Water temperature", value: "58.6", unit: "°F", observedAt: "2026-08-30T12:00:00Z" },
      ],
      observation: null,
    });
    const p = buildPacket(d, "species", { temperature: t }) as never as {
      provenance: Array<Record<string, unknown>>;
    };
    expect(p.provenance[1]!["evidenceClass"]).toBe("observed-retained");
  });
});

describe("doctrine", () => {
  test("no packet in the catalog carries a coordinate or private water", () => {
    for (const record of destinations.slice(0, 50)) {
      const p = buildPacket(record, "species") as never as {
        privacy: { containsCoordinates: boolean; containsPrivateWater: boolean };
      };
      expect(p.privacy.containsCoordinates).toBe(false);
      expect(p.privacy.containsPrivateWater).toBe(false);
      expect(JSON.stringify(p)).not.toMatch(/"lat"|"lon"|"latitude"|"longitude"/);
    }
  });

  test("the packet travels in the fragment, which never reaches a server", () => {
    const url = handoffUrl(d, "species");
    expect(url).toContain("#packet=");
    expect(url.split("#")[0]).not.toContain("packet");
  });
});
