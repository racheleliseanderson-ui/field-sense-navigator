import type { AccessPoint, Destination, WaterType } from "@/lib/catalog";

/**
 * A minimal, valid record. Every test states only the fields it is about,
 * so a failure names the thing that broke rather than the fixture.
 */
export function water(over: Partial<Destination> = {}): Destination {
  return {
    id: "HHI-DEST-TEST",
    state: "Montana",
    region: "Southwest",
    waterbody: "Test Water",
    waterType: "river" as WaterType,
    officialSourceUrl: "https://example.gov/water",
    checkedAt: "2026-08-10T12:00:00.000Z",
    nextReviewAt: "2026-09-30",
    status: "open_public_access",
    speciesContext: [],
    publicAccess: [],
    currentNotices: [],
    directVerification: [],
    privacy: {
      classification: "public_named_water",
      publicLocationIncluded: true,
      sensitiveLocationIncluded: false,
    },
    ...over,
  };
}

export function site(over: Partial<AccessPoint> = {}): AccessPoint {
  return { name: "Test Access", type: "shore", ...over } as AccessPoint;
}

/** A record whose only prose is the line under test. */
export function withNotice(text: string, over: Partial<Destination> = {}) {
  return water({ currentNotices: [text], ...over });
}
