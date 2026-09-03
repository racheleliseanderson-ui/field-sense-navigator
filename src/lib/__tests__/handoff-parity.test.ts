import { describe, expect, test } from "bun:test";

import { destinations, daysSince, displayName, type Destination } from "@/lib/catalog";
import { readAccess } from "@/lib/access";
import { JOBS, readiness } from "@/lib/intelligence";
import { cuesFor, readWater } from "@/lib/water-reading";
import { readPacket } from "@/lib/hth-packet";
import {
  buildPacket,
  handoffUrl,
  mapWaterType,
  temperatureFrom,
  NO_TEMPERATURE,
  type HandoffContext,
  type HandoffTarget,
  type LiveConditionsLike,
} from "@/lib/handoff";
import { water } from "./fixture";

/* ------------------------------------------------------------------ *
 * Adopting the shared module must not change what travels
 *
 * `src/lib/handoff.ts` used to hand-roll the whole packet. It now builds the
 * same object through `@/lib/hth-packet`, and the only honest way to say the
 * fields are unchanged is to keep the old emitter and compare against it.
 *
 * FROZEN. Do not edit the function below to make a test pass. It is a copy of
 * `buildPacket` exactly as it stood before the module was adopted, and its
 * whole value is that nobody has touched it since. If a deliberate protocol
 * change makes it disagree, delete the assertion and say why in the commit —
 * do not quietly bring the copy forward.
 * ------------------------------------------------------------------ */

function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : iso.slice(0, 10);
}

function age(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return daysSince(iso);
}

function legacyBuildPacket(d: Destination, target: HandoffTarget, ctx: HandoffContext = {}) {
  const waterType = mapWaterType(d.waterType);
  const createdAt = new Date().toISOString();
  const read = readWater(d);
  const r = readiness(d);
  const access = readAccess(d);
  const job = ctx.job ? JOBS.find((j) => j.id === ctx.job) : undefined;
  const temp = ctx.temperature ?? NO_TEMPERATURE;

  return {
    packetVersion: "HTH-1.0",
    origin: "field-sense",
    intent: target,
    createdAt,
    instrumentId: "HTH-HH-001",
    fleet: {
      contract: "HTH-FLEET-1.0",
      trail: [{ origin: "field-sense", at: createdAt }],
      lastUpdatedBy: "field-sense",
    },
    water: {
      waterId: d.id,
      waterName: displayName(d),
      waterType,
      waterClass: d.waterType,
      region: d.region,
      state: d.state,
      jurisdiction: [d.county, d.state].filter(Boolean).join(", "),
      documentedSpecies: d.speciesContext,
      selectedSpecies: ctx.species ?? null,
      accessContext: d.status,
      managingAgency: d.managingAgency ?? null,
      officialSourceUrl: d.officialSourceUrl,
    },
    reading: {
      waterClass: read.waterClass,
      headline: read.headline,
      cues: cuesFor(read, ctx.level ?? "working").map((c) => ({
        family: c.family,
        title: c.title,
      })),
      shaped: read.shaped,
    },
    logistics: {
      namedSites: access.namedSites,
      directoryOnly: access.directoryOnly,
      trailerLaunch: access.counts.trailer_launch > 0,
      handLaunch: access.counts.hand_launch > 0,
      shoreAccess: access.counts.shore > 0 || access.counts.pier > 0,
      amenitiesPublished: access.logistics.map((l) => l.id),
    },
    job: job ? { id: job.id, label: job.label } : null,
    readiness: { score: r.score, band: r.band },
    openChecks: d.directVerification,
    conditions: {
      waterType,
      tempF: temp.waterTempF,
      tempUnit: "F",
      tempSource: temp.waterTempF == null ? "unknown" : "official-gauge",
      tempObservedAt: temp.waterTempObservedAt,
      tempRetained: temp.waterTempRetained,
      tempStation: temp.station,
      airTempF: temp.airTempF,
      airTempSource: temp.airTempF == null ? "unknown" : "official-observation",
      airTempObservedAt: temp.airTempObservedAt,
      airTempRetained: temp.airTempRetained,
      airTempStation: temp.observationStation,
    },
    provenance: [
      {
        source: "Field Sense named-public-water record",
        evidenceClass: "declared",
        reviewedAt: day(d.checkedAt),
        ageDays: age(d.checkedAt),
        humanReviewedAt: day(d.lastHumanReviewedAt),
        humanReviewedBy: d.lastHumanReviewedBy ?? null,
        nextReviewAt: day(d.nextReviewAt),
        builtAt: createdAt,
      },
      ...(temp.station && temp.waterTempObservedAt
        ? [
            {
              source: `${temp.station.agency ?? "Agency"} station ${temp.station.id}`,
              evidenceClass: temp.waterTempRetained ? "observed-retained" : "observed",
              reviewedAt: day(temp.waterTempObservedAt),
              ageDays: age(temp.waterTempObservedAt),
              humanReviewedAt: null,
              humanReviewedBy: null,
              nextReviewAt: null,
              builtAt: createdAt,
            },
          ]
        : []),
      ...(temp.observationStation && temp.airTempObservedAt
        ? [
            {
              source: `NWS station ${temp.observationStation.id}`,
              evidenceClass: temp.airTempRetained ? "observed-retained" : "observed",
              reviewedAt: day(temp.airTempObservedAt),
              ageDays: age(temp.airTempObservedAt),
              humanReviewedAt: null,
              humanReviewedBy: null,
              nextReviewAt: null,
              builtAt: createdAt,
            },
          ]
        : []),
    ],
    privacy: {
      containsCoordinates: false,
      containsPrivateWater: false,
    },
  };
}

/**
 * The two packets are built milliseconds apart, so the build stamp differs by
 * construction. Everything else has to match exactly. This replaces each
 * packet's own stamp with a token wherever it appears — the trail hop and the
 * three `builtAt` fields included — so a stamp that had drifted between the two
 * places it is written would still fail the comparison.
 */
function withoutTheClock(packet: unknown): unknown {
  const raw = JSON.stringify(packet);
  const at = (packet as { createdAt: string }).createdAt;
  return JSON.parse(raw.split(at).join("<BUILT>"));
}

/** Key order is a serialisation detail, not a field. Sort it away and compare. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sorted((value as Record<string, unknown>)[key]);
  }
  return out;
}

const live: LiveConditionsLike = {
  station: { id: "01646500", name: "POTOMAC RIVER", agency: "USGS" },
  readings: [
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

const TARGETS: HandoffTarget[] = ["species", "hatch", "rig", "tackle", "knot", "ops"];

describe("the shared module emits what the hand-rolled emitter emitted", () => {
  const cases: Array<[string, Destination, HandoffContext]> = [
    ["a bare record", water(), {}],
    [
      "a record with a review history and species",
      water({
        county: "Gallatin",
        managingAgency: "Montana FWP",
        speciesContext: ["Brown trout", "Rainbow trout"],
        lastHumanReviewedAt: "2026-08-11T00:00:00.000Z",
        lastHumanReviewedBy: "bench",
        directVerification: ["Confirm the ramp is open"],
      }),
      { job: "bank", species: "Brown trout", level: "advanced" },
    ],
    ["a record carrying official temperatures", water(), { temperature: temperatureFrom(live) }],
  ];

  for (const [name, record, ctx] of cases) {
    for (const target of TARGETS) {
      test(`${name}, carried to ${target}`, () => {
        const before = withoutTheClock(legacyBuildPacket(record, target, ctx));
        const after = withoutTheClock(buildPacket(record, target, ctx));
        expect(sorted(after)).toEqual(sorted(before));
        // Same fields, not merely the same values under different names.
        expect(Object.keys(after as object).sort()).toEqual(Object.keys(before as object).sort());
      });
    }
  }

  test("fifty real catalog records, field for field", () => {
    for (const record of destinations.slice(0, 50)) {
      const before = withoutTheClock(legacyBuildPacket(record, "species"));
      const after = withoutTheClock(buildPacket(record, "species"));
      expect(sorted(after)).toEqual(sorted(before));
    }
  });

  test("the handoff URL is the same address it always was", () => {
    for (const target of TARGETS) {
      const url = handoffUrl(water(), target);
      expect(url).toMatch(/^https:\/\/[a-z-]+\.hookthehorizon\.blog\/#packet=/);
    }
  });
});

describe("what the adoption deliberately changed", () => {
  test("nothing, when no packet arrives — Field Sense is still the chain's first hop", () => {
    const packet = buildPacket(water(), "species");
    expect(packet.fleet.trail).toHaveLength(1);
    expect(packet.fleet.trail[0]?.origin).toBe("field-sense");
  });

  test("a packet that arrives is extended rather than replaced", () => {
    const inbound = handoffUrl(water({ id: "HHI-DEST-UPSTREAM" }), "ops");
    const read = readPacket(inbound);
    if (read.state !== "ok") throw new Error("unreachable");
    const packet = buildPacket(water(), "species", { incoming: read });
    expect(packet.fleet.trail).toHaveLength(2);
    expect(packet.fleet.trail.map((h) => h.origin)).toEqual(["field-sense", "field-sense"]);
    // This record's own water wins; the upstream one does not survive as a ghost.
    expect(packet.water?.waterId).toBe("HHI-DEST-TEST");
  });

  test("an invalid or absent read contributes nothing and starts a fresh chain", () => {
    for (const incoming of [readPacket("#packet=%7Bbroken"), readPacket("")]) {
      const packet = buildPacket(water(), "species", { incoming });
      expect(packet.fleet.trail).toHaveLength(1);
    }
  });
});
