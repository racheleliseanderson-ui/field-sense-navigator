import { describe, expect, test } from "bun:test";

import {
  REVIEW_CADENCE_DAYS,
  REVIEW_SPREAD_DAYS,
  destinations,
  reviewOverdue,
  scheduleReview,
} from "@/lib/catalog";
import { water } from "./fixture";

const DAY = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);

describe("review scheduling", () => {
  test("a review date is derived from the record's own check, within the cadence window", () => {
    for (const d of destinations) {
      const gap = (day(d.nextReviewAt) - day(d.checkedAt.slice(0, 10))) / DAY;
      expect(gap).toBeGreaterThanOrEqual(REVIEW_CADENCE_DAYS);
      expect(gap).toBeLessThan(REVIEW_CADENCE_DAYS + REVIEW_SPREAD_DAYS);
    }
  });

  test("the same record always gets the same date — server and client must agree", () => {
    for (const d of destinations.slice(0, 80)) {
      expect(scheduleReview(d)).toBe(scheduleReview(d));
      expect(scheduleReview(d)).toBe(d.nextReviewAt);
    }
  });

  /**
   * The regression this guards: the enrichment layer used to stamp one date
   * on all 523 records, so the whole catalog fell due in the same minute.
   */
  test("the queue is spread, not a single cliff", () => {
    const perDay = new Map<string, number>();
    for (const d of destinations) perDay.set(d.nextReviewAt, (perDay.get(d.nextReviewAt) ?? 0) + 1);
    expect(perDay.size).toBeGreaterThan(20);
    const busiest = Math.max(...perDay.values());
    expect(busiest).toBeLessThan(destinations.length / 10);
  });

  test("records checked on the same day do not all fall due on the same day", () => {
    const sameCheck = destinations.filter((d) => d.checkedAt.startsWith("2026-08-10"));
    expect(sameCheck.length).toBeGreaterThan(50);
    expect(new Set(sameCheck.map((d) => d.nextReviewAt)).size).toBeGreaterThan(10);
  });

  test("an unreadable check date falls back rather than inventing one", () => {
    const d = water({ checkedAt: "not a date", nextReviewAt: "2026-12-01" });
    expect(scheduleReview(d)).toBe("2026-12-01");
  });
});

describe("reviewOverdue", () => {
  test("a date in the past is overdue, today is not", () => {
    const now = new Date("2026-09-02T00:00:00Z");
    expect(reviewOverdue(water({ nextReviewAt: "2026-09-01" }), now)).toBe(true);
    expect(reviewOverdue(water({ nextReviewAt: "2026-09-02" }), now)).toBe(false);
    expect(reviewOverdue(water({ nextReviewAt: "2026-09-03" }), now)).toBe(false);
  });

  test("nothing in the catalog is already overdue on the day this shipped", () => {
    const now = new Date("2026-09-02T00:00:00Z");
    expect(destinations.filter((d) => reviewOverdue(d, now)).length).toBe(0);
  });
});
