import { describe, expect, test } from "bun:test";

import {
  CARRY_WINDOW_MS,
  CHAIN_ORDER,
  FLEET_CONTRACT,
  FLEET_TARGETS,
  INSTRUMENT_ORIGIN,
  ORIGIN_TO_TOOL,
  PACKET_VERSION,
  assessFreshness,
  buildPacket,
  isPacketOk,
  lastHop,
  nextInChain,
  packetAge,
  packetUrl,
  readPacket,
  stripCoordinates,
  type HthPacket,
} from "@/lib/hth-packet";

/**
 * A real Field Sense packet.
 *
 * Field for field, this is what `src/lib/handoff.ts` emits — the canonical
 * shape the other six instruments have to read. It is written out longhand
 * rather than produced by `buildPacket()` so that the round-trip test proves
 * the shared module preserves the CONTRACT, not merely its own output.
 */
const FIELD_SENSE_PACKET: HthPacket = {
  packetVersion: "HTH-1.0",
  origin: "field-sense",
  intent: "species",
  createdAt: "2026-09-02T14:00:00.000Z",
  instrumentId: "HTH-HH-001",
  fleet: {
    contract: "HTH-FLEET-1.0",
    trail: [{ origin: "field-sense", at: "2026-09-02T14:00:00.000Z" }],
    lastUpdatedBy: "field-sense",
  },
  water: {
    waterId: "md-potomac-river",
    waterName: "Potomac River",
    waterType: "flowing",
    waterClass: "river",
    region: "Mid-Atlantic",
    state: "MD",
    jurisdiction: "Montgomery, MD",
    documentedSpecies: ["Smallmouth bass", "Channel catfish"],
    selectedSpecies: "Smallmouth bass",
    accessContext: "open",
    managingAgency: "Maryland DNR",
    officialSourceUrl: "https://dnr.maryland.gov/",
  },
  reading: {
    waterClass: "river",
    headline: "Freestone river with documented current",
    cues: [{ family: "current", title: "Seams and current breaks" }],
    shaped: ["Documented riffle-run-pool sequence"],
  },
  logistics: {
    namedSites: 4,
    directoryOnly: false,
    trailerLaunch: true,
    handLaunch: true,
    shoreAccess: true,
    amenitiesPublished: ["parking", "restrooms"],
  },
  job: { id: "day-trip", label: "Day trip" },
  readiness: { score: 78, band: "Plan with checks" },
  openChecks: ["Confirm the ramp is open", "Check the gauge before travel"],
  conditions: {
    waterType: "flowing",
    tempF: 64.9,
    tempUnit: "F",
    tempSource: "official-gauge",
    tempObservedAt: "2026-09-02T03:00:00Z",
    tempRetained: false,
    tempStation: { id: "01646500", name: "POTOMAC RIVER", agency: "USGS" },
    airTempF: 69.8,
    airTempSource: "official-observation",
    airTempObservedAt: "2026-09-02T03:10:00Z",
    airTempRetained: false,
    airTempStation: { id: "KDCA", name: "Reagan National" },
  },
  provenance: [
    {
      source: "Field Sense named-public-water record",
      evidenceClass: "declared",
      reviewedAt: "2026-08-10",
      ageDays: 23,
      humanReviewedAt: "2026-08-11",
      humanReviewedBy: "bench",
      nextReviewAt: "2026-11-10",
      builtAt: "2026-09-02T14:00:00.000Z",
    },
  ],
  privacy: { containsCoordinates: false, containsPrivateWater: false },
};

const hashOf = (value: unknown) => `#packet=${encodeURIComponent(JSON.stringify(value))}`;

/** The base64url dialect Hatch Match writes. Read, never written. */
function base64url(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("round trip", () => {
  test("a real Field Sense packet survives a full write/read cycle unchanged", () => {
    const url = packetUrl("species", FIELD_SENSE_PACKET);
    const read = readPacket(url);
    expect(read.state).toBe("ok");
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(read.packet).toEqual(FIELD_SENSE_PACKET);
  });

  test("a conforming packet needs no repair, and says so", () => {
    const read = readPacket(hashOf(FIELD_SENSE_PACKET));
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(read.normalizations).toEqual([]);
  });

  test("the packet travels in the fragment, which never reaches a server", () => {
    const url = packetUrl("ops", FIELD_SENSE_PACKET);
    expect(url).toContain("#packet=");
    expect(url.split("#")[0]).not.toContain("packet");
    // A bare host gets the root slash, so a link checker has nothing to rewrite.
    expect(url.split("#")[0]).toBe(`${FLEET_TARGETS.ops.url}/`);
  });

  test("the base64url dialect is read as readily as the URI-encoded one", () => {
    const read = readPacket(`#packet=${base64url(FIELD_SENSE_PACKET)}`);
    expect(read.state).toBe("ok");
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(read.packet.water?.waterName).toBe("Potomac River");
  });
});

describe("the version gate", () => {
  test("a packet from another protocol version is refused, with a reason to show", () => {
    const read = readPacket(hashOf({ ...FIELD_SENSE_PACKET, packetVersion: "HTH-2.0" }));
    expect(read.state).toBe("invalid");
    if (read.state !== "invalid") throw new Error("unreachable");
    expect(read.code).toBe("version-mismatch");
    expect(read.reason).toContain("HTH-2.0");
    expect(read.reason).toContain(PACKET_VERSION);
  });

  test("a packet from another fleet contract is refused", () => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        fleet: { ...FIELD_SENSE_PACKET.fleet, contract: "HTH-FLEET-0.9" },
      }),
    );
    expect(read.state).toBe("invalid");
    if (read.state !== "invalid") throw new Error("unreachable");
    expect(read.code).toBe("contract-mismatch");
    expect(read.reason).toContain(FLEET_CONTRACT);
  });

  test("an unversioned stranger is refused rather than half-read", () => {
    const read = readPacket(hashOf({ water: { waterName: "Somewhere" } }));
    expect(read.state).toBe("invalid");
    if (read.state !== "invalid") throw new Error("unreachable");
    expect(read.code).toBe("version-mismatch");
  });

  test("the documented Hatch Match legacy stamp is repaired, and the repair is reported", () => {
    const legacy = {
      applicationId: "HTH-HM-001",
      schemaVersion: "1.2.0",
      createdAt: "2026-09-02T13:00:00.000Z",
      observations: { forage: { class: "aquatic_insects" } },
    };
    const read = readPacket(`#packet=${base64url(legacy)}`);
    expect(read.state).toBe("ok");
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(read.packet.fleet.contract).toBe(FLEET_CONTRACT);
    expect(read.normalizations.length).toBe(2);
    // Repaired, never silently: the caller can show exactly what was assumed.
    expect(read.normalizations.join(" ")).toContain("HTH-HM-001");
    // The seeded hop keeps the sender's own stamp, so the age stays honest.
    expect(lastHop(read.packet)).toEqual({
      origin: "hatch-match",
      at: "2026-09-02T13:00:00.000Z",
    });
  });
});

describe("the three-state read", () => {
  test("no packet at all is absent, not an error", () => {
    expect(readPacket("").state).toBe("absent");
    expect(readPacket("https://species.hookthehorizon.blog/").state).toBe("absent");
    expect(readPacket("#other=1").state).toBe("absent");
    expect(readPacket("#packet=").state).toBe("absent");
  });

  test("a truncated fragment is invalid, never absent, and never throws", () => {
    const truncated = hashOf(FIELD_SENSE_PACKET).slice(0, 120);
    const read = readPacket(truncated);
    expect(read.state).toBe("invalid");
    if (read.state !== "invalid") throw new Error("unreachable");
    expect(read.code).toBe("unreadable");
    expect(read.reason.length).toBeGreaterThan(0);
  });

  test("garbage is invalid, never absent", () => {
    expect(readPacket("#packet=%%%not-json").state).toBe("invalid");
  });

  test("a JSON array is not a packet", () => {
    const read = readPacket(hashOf([1, 2, 3]));
    if (read.state !== "invalid") throw new Error("unreachable");
    expect(read.code).toBe("not-an-object");
  });

  test("nothing readPacket is handed can make it throw", () => {
    const hostile = [
      "#packet=" + "%".repeat(50),
      "#packet=" + "A".repeat(5000),
      "#packet=null",
      "#packet=" + encodeURIComponent('{"packetVersion":'),
      "#packet=" + encodeURIComponent('"just a string"'),
      "########",
      "#packet=&packet=",
    ];
    for (const input of hostile) {
      expect(() => readPacket(input)).not.toThrow();
      expect(["absent", "invalid"]).toContain(readPacket(input).state);
    }
  });

  test("the packet parameter is found wherever it sits in the fragment", () => {
    const read = readPacket(
      `#tab=water&packet=${encodeURIComponent(JSON.stringify(FIELD_SENSE_PACKET))}`,
    );
    expect(read.state).toBe("ok");
  });
});

describe("coordinates", () => {
  const dirty = {
    lat: 39.01,
    lon: -77.24,
    water: {
      waterName: "Somewhere Creek",
      centroid: { latitude: 39.01, longitude: -77.24 },
      sites: [
        { name: "Lower ramp", coords: [39.01, -77.24] },
        { name: "Upper ramp", nested: { deeper: { gps: "39N 77W", pin: 4 } } },
      ],
    },
  };

  test("every coordinate-shaped key is removed, at any depth and inside arrays", () => {
    const clean = JSON.stringify(stripCoordinates(dirty));
    for (const key of ["lat", "lon", "latitude", "longitude", "centroid", "coords", "gps", "pin"]) {
      expect(clean).not.toContain(`"${key}"`);
    }
    // and nothing legitimate is lost on the way
    expect(clean).toContain("Somewhere Creek");
    expect(clean).toContain("Lower ramp");
    expect(clean).toContain("Upper ramp");
  });

  test("a value that merely looks like a place name is untouched — keys only", () => {
    const kept = stripCoordinates({ holding: "point", season: "spring", note: "lat is fine here" });
    expect(kept).toEqual({ holding: "point", season: "spring", note: "lat is fine here" });
  });

  test("coordinates are stripped on the way OUT", () => {
    const packet = buildPacket({ origin: "field-sense", water: dirty.water });
    expect(JSON.stringify(packet)).not.toMatch(/"lat"|"lon"|"coords"|"gps"|"centroid"/);
    expect(packet.privacy?.containsCoordinates).toBe(false);
  });

  test("coordinates are stripped on the way IN, whatever the sender claimed", () => {
    // A sender that leaks coordinates AND asserts it does not. Both happen.
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        ...dirty,
        privacy: { containsCoordinates: true, containsPrivateWater: true },
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(JSON.stringify(read.packet)).not.toMatch(/"lat"|"lon"|"coords"|"gps"|"centroid"/);
    // Two fields, two rules. The coordinate claim is restated as this file's own
    // fact, because the strip above actually ran. The private-water warning is
    // not this file's to check, so it is carried exactly as it arrived.
    expect(read.packet.privacy).toEqual({
      containsCoordinates: false,
      containsPrivateWater: true,
    });
  });
});

describe("the private-water warning", () => {
  const privatePacket = {
    ...FIELD_SENSE_PACKET,
    privacy: { containsCoordinates: false, containsPrivateWater: true },
  };

  test("it survives a re-emit by an instrument that never set it", () => {
    const read = readPacket(hashOf(privatePacket));
    if (!isPacketOk(read)) throw new Error("unreachable");
    const reemitted = buildPacket({ origin: "tackle-link-analyst", incoming: read });
    expect(reemitted.privacy?.containsPrivateWater).toBe(true);
  });

  test("it survives three hops, none of which claim it", () => {
    let packet = buildPacket({
      origin: "field-sense",
      privacy: { containsPrivateWater: true },
    });
    for (const origin of ["species-presentation", "tackle-link-analyst", "knot-analyst"]) {
      packet = buildPacket({ origin, incoming: packet });
    }
    expect(packet.privacy?.containsPrivateWater).toBe(true);
  });

  test("an instrument may raise the warning on a packet that arrived without it", () => {
    const first = buildPacket({ origin: "field-sense" });
    expect(first.privacy?.containsPrivateWater).toBe(false);
    const second = buildPacket({
      origin: "field-ops-desk",
      incoming: first,
      privacy: { containsPrivateWater: true },
    });
    expect(second.privacy?.containsPrivateWater).toBe(true);
  });

  test("the coordinate claim is still this file's own, not the sender's", () => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        privacy: { containsCoordinates: true, containsPrivateWater: false },
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(read.packet.privacy?.containsCoordinates).toBe(false);
  });
});

describe("one dialect out", () => {
  const withConditions = (conditions: Record<string, unknown>) => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        conditions: { ...FIELD_SENSE_PACKET.conditions, ...conditions },
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    return read;
  };

  test("the snake temperature-source spellings normalise to the kebab ones", () => {
    const read = withConditions({ tempSource: "official_station", airTempSource: "user_measured" });
    expect(read.packet.conditions?.tempSource).toBe("official-station");
    expect(read.packet.conditions?.airTempSource).toBe("user-measured");
    expect(read.normalizations.join(" ")).toContain("official-station");
  });

  test("an already-canonical source is left alone and reported as nothing", () => {
    const read = withConditions({ tempSource: "official-gauge" });
    expect(read.packet.conditions?.tempSource).toBe("official-gauge");
    expect(read.normalizations).toEqual([]);
  });

  test("the snake evidence spellings normalise too", () => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        provenance: [
          { source: "an angler", evidenceClass: "user_measured" },
          { source: "a gauge", evidenceClass: "official_station" },
          { source: "the record", evidenceClass: "declared" },
        ],
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    const classes = (read.packet.provenance ?? []).map((e) => e.evidenceClass);
    expect(classes).toEqual(["user-measured", "official-station", "declared"]);
  });

  test("both temperature-range shapes read, and only one is emitted", () => {
    const asObject = withConditions({ tempRangeF: { low: 52, high: 61 } });
    expect(asObject.packet.conditions?.tempRangeF).toEqual({ low: 52, high: 61 });
    expect(asObject.normalizations).toEqual([]);

    const asTuple = withConditions({ tempRangeF: [52, 61] });
    expect(asTuple.packet.conditions?.tempRangeF).toEqual({ low: 52, high: 61 });
    expect(asTuple.normalizations.join(" ")).toContain("temperature range");

    const asMinMax = withConditions({ tempRangeF: { min: 61, max: 52 } });
    expect(asMinMax.packet.conditions?.tempRangeF).toEqual({ low: 52, high: 61 });
  });

  test("a range that is not a usable pair of numbers is dropped, not half-read", () => {
    const read = withConditions({ tempRangeF: [52] });
    expect(read.packet.conditions?.tempRangeF).toBeUndefined();
    expect(read.normalizations.join(" ")).toContain("Dropped");
  });

  test("a tuple handed to buildPacket leaves as an object", () => {
    const packet = buildPacket({
      origin: "species-presentation",
      conditions: { tempRangeF: [61, 52] },
    });
    expect(packet.conditions?.tempRangeF).toEqual({ low: 52, high: 61 });
  });

  test("Rig Signal's pressure-trend spellings map onto the fleet trends", () => {
    expect(withConditions({ weather: "falling" }).packet.conditions?.weather).toBe(
      "frontal_change",
    );
    expect(withConditions({ weather: "front_approaching" }).packet.conditions?.weather).toBe(
      "frontal_change",
    );
    expect(withConditions({ weather: "rising" }).packet.conditions?.weather).toBe("post_front");
  });

  test("the two spellings the vocabularies already share are not rewritten", () => {
    const stable = withConditions({ weather: "stable" });
    expect(stable.packet.conditions?.weather).toBe("stable");
    expect(stable.normalizations).toEqual([]);
    expect(withConditions({ weather: "post_front" }).packet.conditions?.weather).toBe("post_front");
  });
});

describe("the trail", () => {
  test("it appends across three hops instead of being replaced", () => {
    const hop1 = buildPacket({
      origin: "field-sense",
      instrumentId: "HTH-HH-001",
      now: "2026-09-02T14:00:00.000Z",
      water: { waterName: "Potomac River" },
    });
    const hop2 = buildPacket({
      origin: "species-presentation",
      incoming: hop1,
      now: "2026-09-02T14:05:00.000Z",
      blocks: { hypotheses: { thermalState: "optimal" } },
    });
    const hop3 = buildPacket({
      origin: "tackle-link",
      incoming: hop2,
      now: "2026-09-02T14:10:00.000Z",
    });

    expect(hop3.fleet.trail.map((t) => t.origin)).toEqual([
      "field-sense",
      "species-presentation",
      "tackle-link",
    ]);
    expect(hop3.fleet.lastUpdatedBy).toBe("tackle-link");
    // Extended, not replaced: hop 1's water and hop 2's own block both survive.
    expect(hop3.water?.waterName).toBe("Potomac River");
    expect(hop3["hypotheses"]).toEqual({ thermalState: "optimal" });
  });

  test("a receiver may hand its readPacket result straight back in", () => {
    const read = readPacket(hashOf(FIELD_SENSE_PACKET));
    const next = buildPacket({ origin: "species-presentation", incoming: read });
    expect(next.fleet.trail.map((t) => t.origin)).toEqual(["field-sense", "species-presentation"]);
  });

  test("an invalid read contributes nothing and starts a fresh chain", () => {
    const read = readPacket("#packet=%%%not-json");
    const next = buildPacket({ origin: "species-presentation", incoming: read });
    expect(next.fleet.trail.map((t) => t.origin)).toEqual(["species-presentation"]);
  });

  test("a half-formed trail entry is dropped rather than carried", () => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        fleet: {
          ...FIELD_SENSE_PACKET.fleet,
          trail: [{ origin: "field-sense" }, { at: "2026-09-02T14:00:00.000Z" }, "nonsense"],
        },
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    // An entry with no stamp would make packetAge() read a hop it cannot date,
    // so all three are dropped — and because that leaves no trail at all, one
    // hop is re-seeded from the sender's own createdAt and the repair reported.
    expect(read.packet.fleet.trail).toEqual([
      { origin: "field-sense", at: "2026-09-02T14:00:00.000Z" },
    ]);
    expect(read.normalizations.join(" ")).toContain("no fleet trail");
  });
});

describe("packetAge", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");

  test("it measures from the last trail entry, not from createdAt", () => {
    /*
     * The exact bug this replaces: the Field Ops Desk read `createdAt`. Here
     * `createdAt` claims one minute ago while the trail says an hour. The trail
     * is the field the contract guarantees, so an hour is the answer.
     */
    const packet: HthPacket = {
      ...FIELD_SENSE_PACKET,
      createdAt: "2026-09-02T14:59:00.000Z",
      fleet: {
        ...FIELD_SENSE_PACKET.fleet,
        trail: [
          { origin: "field-sense", at: "2026-09-02T13:00:00.000Z" },
          { origin: "species-presentation", at: "2026-09-02T14:00:00.000Z" },
        ],
      },
    };
    expect(packetAge(packet, now)).toBe(60 * 60_000);
  });

  test("createdAt is a fallback only, for a packet with no usable trail", () => {
    const packet: HthPacket = {
      ...FIELD_SENSE_PACKET,
      createdAt: "2026-09-02T14:30:00.000Z",
      fleet: { ...FIELD_SENSE_PACKET.fleet, trail: [] },
    };
    expect(packetAge(packet, now)).toBe(30 * 60_000);
  });

  test("a packet with neither is null, which is not the same as zero", () => {
    const packet: HthPacket = {
      ...FIELD_SENSE_PACKET,
      createdAt: null,
      fleet: { ...FIELD_SENSE_PACKET.fleet, trail: [] },
    };
    expect(packetAge(packet, now)).toBeNull();
  });

  test("a sender's fast clock cannot make a packet arrive from the future", () => {
    const packet: HthPacket = {
      ...FIELD_SENSE_PACKET,
      fleet: {
        ...FIELD_SENSE_PACKET.fleet,
        trail: [{ origin: "field-sense", at: "2026-09-02T16:00:00.000Z" }],
      },
    };
    expect(packetAge(packet, now)).toBe(0);
  });
});

describe("assessFreshness", () => {
  const at = (iso: string): HthPacket => ({
    ...FIELD_SENSE_PACKET,
    fleet: { ...FIELD_SENSE_PACKET.fleet, trail: [{ origin: "field-sense", at: iso }] },
  });
  const now = new Date("2026-09-02T15:00:00.000Z");

  test("inside the sender's window is clear", () => {
    const g = assessFreshness(at("2026-09-02T14:50:00.000Z"), { now });
    expect(g.severity).toBe("clear");
    expect(g.windowMs).toBe(CARRY_WINDOW_MS["field-sense-navigator"]);
  });

  test("near the end of the window is a caution, not a pass", () => {
    const g = assessFreshness(at("2026-09-02T14:20:00.000Z"), { now });
    expect(g.severity).toBe("caution");
    expect(g.expired).toBe(false);
  });

  test("past the window is blocked", () => {
    const g = assessFreshness(at("2026-09-02T13:00:00.000Z"), { now });
    expect(g.severity).toBe("blocked");
    expect(g.expired).toBe(true);
    expect(g.detail).toContain("45-minute window");
  });

  test("the window follows the sender, so a knot answer outlives a water answer", () => {
    const knot: HthPacket = {
      ...at("2026-09-02T13:00:00.000Z"),
      fleet: {
        contract: FLEET_CONTRACT,
        trail: [{ origin: "knot-analyst", at: "2026-09-02T13:00:00.000Z" }],
        lastUpdatedBy: "knot-analyst",
      },
    };
    expect(assessFreshness(knot, { now }).severity).toBe("clear");
  });

  test("an age that cannot be measured fails to caution, never to clear", () => {
    const g = assessFreshness(
      { ...FIELD_SENSE_PACKET, createdAt: null, fleet: { ...FIELD_SENSE_PACKET.fleet, trail: [] } },
      { now },
    );
    expect(g.severity).toBe("caution");
    expect(g.measured).toBe(false);
  });

  test("an ageless packet reports expired: false, which is why callers gate on severity", () => {
    const g = assessFreshness(
      { ...FIELD_SENSE_PACKET, createdAt: null, fleet: { ...FIELD_SENSE_PACKET.fleet, trail: [] } },
      { now },
    );
    // Correct, and a trap: there was no age to expire. `severity` folds in the
    // unmeasurable case; `expired` on its own makes an ageless packet look fresh.
    expect(g.expired).toBe(false);
    expect(g.measured).toBe(false);
    expect(g.severity).not.toBe("clear");
  });

  test("one minute reads as one minute, not as one minute(s)", () => {
    const g = assessFreshness(at("2026-09-02T14:59:30.000Z"), { now });
    expect(g.detail).toContain("Carried 1 minute ago");
    expect(g.detail).not.toContain("(s)");
  });

  test("every band pluralises, and none of them show the parenthesis", () => {
    for (const iso of [
      "2026-09-02T14:59:30.000Z",
      "2026-09-02T14:50:00.000Z",
      "2026-09-02T14:20:00.000Z",
      "2026-09-02T13:00:00.000Z",
    ]) {
      const detail = assessFreshness(at(iso), { now }).detail;
      expect(detail).not.toContain("(s)");
      expect(detail).toMatch(/\b\d+ minutes? ago\b/);
      if (/\b1 minutes? ago\b/.test(detail)) expect(detail).toContain("1 minute ago");
    }
  });

  test("the window with one minute in it also reads as one minute", () => {
    const g = assessFreshness(at("2026-09-02T14:58:00.000Z"), { now, windowMs: 60_000 });
    expect(g.detail).toContain("2 minutes ago");
    expect(g.detail).not.toContain("(s)");
  });
});

describe("instrument ids", () => {
  test("every registered id resolves to a fleet name and a tool key", () => {
    for (const [id, origin] of Object.entries(INSTRUMENT_ORIGIN)) {
      expect(id).toMatch(/^HTH-[A-Z]{2,3}-\d{3}$/);
      expect(ORIGIN_TO_TOOL[id]).toBeDefined();
      expect(ORIGIN_TO_TOOL[origin]).toBeDefined();
    }
  });

  test("the three instruments that were missing now resolve", () => {
    expect(INSTRUMENT_ORIGIN["HTH-TL-001"]).toBe("tackle-link-analyst");
    expect(INSTRUMENT_ORIGIN["HTH-KN-001"]).toBe("knot-analyst");
    expect(INSTRUMENT_ORIGIN["HTH-OPS-001"]).toBe("field-ops-desk");
  });

  test("a sender that gives an id and no origin gets its fleet name in the trail", () => {
    const read = readPacket(
      hashOf({
        ...FIELD_SENSE_PACKET,
        origin: undefined,
        instrumentId: "HTH-KN-001",
        createdAt: "2026-09-02T14:00:00.000Z",
        fleet: { contract: FLEET_CONTRACT, trail: [], lastUpdatedBy: "" },
      }),
    );
    if (!isPacketOk(read)) throw new Error("unreachable");
    expect(lastHop(read.packet)?.origin).toBe("knot-analyst");
    expect(read.packet.origin).toBe("knot-analyst");
  });

  test("the desk's three-letter id is graded against the desk's own window", () => {
    const packet: HthPacket = {
      ...FIELD_SENSE_PACKET,
      instrumentId: "HTH-OPS-001",
      origin: "HTH-OPS-001",
      fleet: {
        contract: FLEET_CONTRACT,
        trail: [{ origin: "HTH-OPS-001", at: "2026-09-02T13:00:00.000Z" }],
        lastUpdatedBy: "HTH-OPS-001",
      },
    };
    const g = assessFreshness(packet, { now: new Date("2026-09-02T15:00:00.000Z") });
    expect(g.windowMs).toBe(CARRY_WINDOW_MS["field-ops-desk"]);
    expect(g.severity).toBe("clear");
  });
});

describe("the fleet registry", () => {
  test("the chain is the chain, and Rig Signal is not in it", () => {
    expect([...CHAIN_ORDER]).toEqual(["water", "species", "hatch", "tackle", "knot", "ops"]);
    expect(CHAIN_ORDER).not.toContain("rig");
    expect(FLEET_TARGETS.rig.role).toBe("sidecar");
    expect(nextInChain("rig")).toBeNull();
    expect(nextInChain("water")).toBe("species");
    expect(nextInChain("ops")).toBeNull();
  });

  test("every target has an address and none of them carry a trailing slash", () => {
    for (const target of Object.values(FLEET_TARGETS)) {
      expect(target.url).toMatch(/^https:\/\/[a-z-]+\.hookthehorizon\.blog$/);
    }
  });

  test("a bare base URL works as a target, for a route inside an instrument", () => {
    const url = packetUrl("https://ops.hookthehorizon.blog/debrief", FIELD_SENSE_PACKET);
    expect(url.startsWith("https://ops.hookthehorizon.blog/debrief#packet=")).toBe(true);
  });
});
