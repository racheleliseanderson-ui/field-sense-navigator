import { describe, expect, test } from "bun:test";

import { allEvents, eventsFor, sharpenedFor } from "@/lib/condition-response";
import { destinations } from "@/lib/catalog";
import type { WaterType } from "@/lib/catalog";
import type { ReadLevel } from "@/lib/water-reading";

const CLASSES: WaterType[] = ["river", "lake", "reservoir", "marine"];
const LEVELS: ReadLevel[] = ["learning", "working", "advanced"];

/**
 * The change library keeps its promises.
 *
 * Every entry has to say how long the change lasts, how to confirm it standing
 * there, and what it does NOT change. That last one is the guard against the
 * commonest failure in fishing advice — one variable moving and somebody
 * rewriting the whole day around it — so it is a hard requirement rather than
 * a nice-to-have.
 */
describe("condition response", () => {
  test("every class has something to say at every level", () => {
    for (const c of CLASSES) {
      for (const l of LEVELS) {
        const events = eventsFor(c, l);
        expect(events.length).toBeGreaterThan(0);
        for (const e of events) expect(e.notes.length).toBeGreaterThan(0);
      }
    }
  });

  test("a learning reader gets fewer changes than an advanced one, never more", () => {
    for (const c of CLASSES) {
      const learning = eventsFor(c, "learning");
      const advanced = eventsFor(c, "advanced");
      expect(learning.length).toBeLessThanOrEqual(advanced.length);
      const learningNotes = learning.reduce((n, e) => n + e.notes.length, 0);
      const advancedNotes = advanced.reduce((n, e) => n + e.notes.length, 0);
      expect(learningNotes).toBeLessThan(advancedNotes);
    }
  });

  test("every event says how long, how to confirm, and what it does not change", () => {
    for (const e of allEvents()) {
      expect(e.headline.length).toBeGreaterThan(40);
      expect(e.window.length).toBeGreaterThan(20);
      expect(e.doesNotChange.length).toBeGreaterThan(30);
      expect(e.applies.length).toBeGreaterThan(0);
      for (const n of e.notes) {
        expect(n.what.length).toBeGreaterThan(20);
        expect(n.where.length).toBeGreaterThan(20);
        expect(n.confirm.length).toBeGreaterThan(15);
      }
    }
  });

  test("an event is only offered on water it applies to", () => {
    for (const c of CLASSES) {
      for (const e of eventsFor(c, "advanced")) {
        expect(e.applies).toContain(c);
      }
    }
  });

  test("nothing here predicts fish or reads a gauge", () => {
    // The instrument's whole argument is that it holds no conditions for this
    // water today. A change library is exactly where that would erode first.
    const banned = [
      "will be biting",
      "guaranteed",
      "hot bite",
      "always works",
      "the fish will",
      "current flow is",
      "today's",
    ];
    const prose = JSON.stringify(allEvents()).toLowerCase();
    for (const phrase of banned) {
      expect(prose).not.toContain(phrase);
    }
  });

  test("reservoirs are sharpened for the things only a reservoir does", () => {
    const res = destinations.find((d) => d.waterType === "reservoir");
    expect(res).toBeDefined();
    if (!res) return;
    const sharp = sharpenedFor(res);
    expect(sharp).toContain("drawdown");
    expect(sharp).toContain("release");
  });

  test("sharpening never invents an event the class does not have", () => {
    for (const d of destinations.slice(0, 200)) {
      const offered = new Set(eventsFor(d.waterType, "advanced").map((e) => e.event));
      for (const s of sharpenedFor(d)) {
        expect(offered.has(s)).toBe(true);
      }
    }
  });
});
