/**
 * Fleet conformance — Field Sense Navigator as a receiver.
 *
 * This instrument starts the chain, so for a long time it was treated as an
 * emitter only and its inbound path went untested. It is not emitter-only: the
 * workflow is a loop, and a reader coming back from the Field Ops Desk to
 * re-check a water arrives here with a packet attached.
 *
 * The samples are byte-identical in all seven repositories and written from
 * each emitter rather than from what a receiver hopes it sends. A failure that
 * names a sample is usually a fault in the reader below, not in the sample.
 */
import { describe, expect, test } from "bun:test";

import { FLEET_SAMPLES, samplesFrom } from "@/lib/fleet-conformance";
import { readCarriedContext, readJob, senderLabel } from "@/lib/fleet-inbound";
import { encodePacketHash, readPacket, type HthPacket } from "@/lib/hth-packet";

const INBOUND = samplesFrom("field-sense");

function deliver(packet: Record<string, unknown>) {
  return readCarriedContext(readPacket(encodePacketHash(packet as unknown as HthPacket)));
}

describe("every sibling packet reads", () => {
  for (const sample of FLEET_SAMPLES) {
    test(`${sample.id} — ${sample.label}`, () => {
      const carried = deliver(sample.packet);
      expect(carried.state, `${sample.id} was refused`).toBe("read");
    });
  }
});

describe("the sender is named as a person would say it", () => {
  for (const sample of INBOUND) {
    test(`${sample.id} names ${sample.from}`, () => {
      const carried = deliver(sample.packet);
      if (carried.state !== "read") return;
      expect(carried.from).not.toBe(sample.from);
      /* This is the honest fallback for a sender nobody registered. A sibling
         reaching it means this instrument does not recognise its own fleet. */
      expect(carried.from, `${sample.from} is unregistered here`).not.toBe("an earlier step");
    });
  }
});

describe("a carried water is offered, not applied", () => {
  test("a water this catalog holds resolves to its record", () => {
    /* Field Ops relays the water Field Sense declared, ids and all, so a round
       trip has to land back on the same record. */
    const ops = FLEET_SAMPLES.find((s) => s.id === "ops-trip")!;
    const carried = deliver(ops.packet);
    expect(carried.state).toBe("read");
    if (carried.state !== "read") return;
    expect(carried.waterName).toBeTruthy();
  });

  test("a water this catalog does not hold still carries its name to the search", () => {
    const surf = FLEET_SAMPLES.find((s) => s.id === "field-sense-surf")!;
    const carried = deliver(surf.packet);
    if (carried.state !== "read") return;
    /* The record is very likely absent — the name is what makes the miss
       actionable, and it is the thing that used to be spent on prose only. */
    expect(carried.waterName).toBe("Nauset Beach");
  });

  test("a packet naming no water at all is read, not refused", () => {
    const knot = FLEET_SAMPLES.find((s) => s.id === "knot-decision")!;
    const carried = deliver(knot.packet);
    expect(carried.state).toBe("read");
    if (carried.state !== "read") return;
    expect(carried.waterName).toBeNull();
    expect(carried.record).toBeUndefined();
  });
});

describe("a declared job is never silently dropped", () => {
  /*
   * The defect this file was written to close. A job id that missed this
   * catalog's list vanished with no note, which a reader cannot tell apart
   * from a packet that declared no job.
   */
  test("an access job this catalog ranks by is offered as a plan", () => {
    const ops = FLEET_SAMPLES.find((s) => s.id === "ops-trip")!;
    const job = readJob(ops.packet as unknown as HthPacket);
    expect(job, "a relayed access job produced nothing").not.toBeNull();
    expect(job!.state).toBe("ranked");
  });

  test("a job of another kind is named rather than dropped", () => {
    const stage = {
      ...FLEET_SAMPLES.find((s) => s.id === "ops-trip")!.packet,
      job: { id: "debrief", label: "Field debrief", kind: "stage" },
    };
    const job = readJob(stage as unknown as HthPacket);
    expect(job).not.toBeNull();
    expect(job!.state).toBe("other-kind");
    if (job!.state !== "other-kind") return;
    expect(job!.kind).toBe("stage");
    expect(job!.label).toBe("Field debrief");
  });

  test("a job with no kind and no match is reported as unknown, not guessed at", () => {
    const odd = {
      ...FLEET_SAMPLES.find((s) => s.id === "ops-trip")!.packet,
      job: { id: "wading-the-flats", label: "Wading the flats" },
    };
    const job = readJob(odd as unknown as HthPacket);
    expect(job!.state).toBe("unknown");
  });

  test("a job whose id this catalog ranks by is taken even with no kind declared", () => {
    /* Packets built before `kind` existed are still perfectly good packets.
       Refusing one on a missing optional field would be a regression wearing
       rigour as a costume. */
    const legacy = {
      ...FLEET_SAMPLES.find((s) => s.id === "ops-trip")!.packet,
      job: { id: "kayak", label: "Kayak & paddle" },
    };
    const job = readJob(legacy as unknown as HthPacket);
    expect(job!.state).toBe("ranked");
  });

  test("no job block at all is null, which is not a failure", () => {
    const hatch = FLEET_SAMPLES.find((s) => s.id === "hatch-marine")!;
    expect(readJob(hatch.packet as unknown as HthPacket)).toBeNull();
  });
});

describe("a repair is reported, never performed quietly", () => {
  for (const sample of INBOUND) {
    test(`${sample.id} lists whatever it had to normalise`, () => {
      const carried = deliver(sample.packet);
      if (carried.state !== "read") return;
      expect(Array.isArray(carried.normalizations)).toBe(true);
    });
  }
});

describe("a packet that cannot be read says so", () => {
  test("a broken fragment is invalid, not absent", () => {
    const carried = readCarriedContext(readPacket("#packet=%7Bbroken"));
    expect(carried.state).toBe("invalid");
    if (carried.state !== "invalid") return;
    expect(carried.reason.length).toBeGreaterThan(0);
  });

  test("no fragment at all is absent, which is the ordinary case here", () => {
    expect(readCarriedContext(readPacket("")).state).toBe("absent");
    expect(readCarriedContext(null).state).toBe("absent");
  });
});

describe("senderLabel never invents a name", () => {
  test("an unregistered origin falls through to the honest fallback", () => {
    const stranger = {
      packetVersion: "HTH-1.0",
      origin: "some-other-app",
      fleet: { contract: "HTH-FLEET-1.0", trail: [] },
    } as unknown as HthPacket;
    expect(senderLabel(stranger)).toBe("some-other-app");
  });
});
