/**
 * Where the reading cues actually sit in the water.
 *
 * `water-reading.ts` says what to look for and why fish relate to it. That is
 * the harder half and it is written well. What it cannot do in prose is
 * answer the question a beginner asks immediately and never says out loud:
 * *where is that, exactly?* "The line where fast water runs against slow" is
 * a perfectly good sentence and it does not put anybody's feet anywhere.
 *
 * So this module places the spatial cues on a section through the water —
 * near side on the left, surface at the top — and leaves the rest alone. Some
 * cues are not spatial at all: a rising level, a wind direction, a seasonal
 * drawdown describe the whole system rather than a place in it, and drawing
 * them somewhere would be inventing a location to make the picture look
 * fuller. Those stay in the cue list, where they belong.
 *
 * Nothing here is an observation of today's water. It is the same standing
 * craft the rest of the module carries, drawn instead of described.
 */

import type { WaterSectionKind, WaterSectionSpec, SectionZone } from "@/lib/field-plates";
import type { WaterType } from "@/lib/catalog";
import type { ReadCue, WaterRead } from "@/lib/water-reading";

/** Position of a cue in the section, as fractions of the water body. */
type Placement = { x: number; y: number; w: number; h: number };

/**
 * Placements, by cue id.
 *
 * A cue with no entry is not drawn. That is the common case for anything
 * describing the system rather than a place in it — level, drawdown, wind,
 * seasonal thermal state — and it is deliberate.
 */
const PLACEMENT: Record<string, Placement> = {
  /* River */
  seam: { x: 0.36, y: 0.06, w: 0.16, h: 0.5 },
  "outside-bend": { x: 0.7, y: 0.24, w: 0.24, h: 0.56 },
  eddy: { x: 0.04, y: 0.08, w: 0.18, h: 0.34 },
  confluence: { x: 0.76, y: 0.02, w: 0.2, h: 0.3 },
  wood: { x: 0.16, y: 0.5, w: 0.2, h: 0.34 },
  drop: { x: 0.52, y: 0.42, w: 0.2, h: 0.46 },
  foam: { x: 0.3, y: 0.0, w: 0.3, h: 0.1 },
  hydraulics: { x: 0.56, y: 0.6, w: 0.18, h: 0.34 },
  "riffle-run-pool": { x: 0.24, y: 0.62, w: 0.34, h: 0.32 },

  /* Lake */
  points: { x: 0.06, y: 0.3, w: 0.24, h: 0.4 },
  "weed-edge": { x: 0.26, y: 0.46, w: 0.24, h: 0.3 },
  breakline: { x: 0.46, y: 0.34, w: 0.16, h: 0.52 },
  inflow: { x: 0.02, y: 0.0, w: 0.16, h: 0.22 },
  cover: { x: 0.12, y: 0.52, w: 0.16, h: 0.3 },
  flat: { x: 0.04, y: 0.12, w: 0.28, h: 0.22 },
  thermal: { x: 0.62, y: 0.34, w: 0.34, h: 0.14 },

  /* Reservoir */
  channel: { x: 0.54, y: 0.5, w: 0.26, h: 0.44 },
  "arm-point": { x: 0.08, y: 0.26, w: 0.22, h: 0.42 },
  timber: { x: 0.3, y: 0.5, w: 0.2, h: 0.4 },
  riprap: { x: 0.02, y: 0.14, w: 0.16, h: 0.44 },
  "inflow-colour": { x: 0.78, y: 0.02, w: 0.2, h: 0.26 },
  bluff: { x: 0.8, y: 0.16, w: 0.18, h: 0.62 },

  /* Marine */
  "channel-edge": { x: 0.5, y: 0.4, w: 0.22, h: 0.5 },
  "hard-structure": { x: 0.26, y: 0.48, w: 0.2, h: 0.4 },
  rips: { x: 0.6, y: 0.02, w: 0.24, h: 0.28 },
  "bottom-change": { x: 0.32, y: 0.66, w: 0.3, h: 0.26 },
  surf: { x: 0.02, y: 0.0, w: 0.24, h: 0.36 },
  "bait-birds": { x: 0.66, y: 0.0, w: 0.26, h: 0.16 },
};

const KIND: Record<WaterType, WaterSectionKind> = {
  river: "flowing",
  lake: "stillwater",
  reservoir: "stillwater",
  marine: "inshore",
};

const EDGES: Record<WaterType, [string, string]> = {
  river: ["Near bank", "Far bank"],
  lake: ["Shoreline", "Open water"],
  reservoir: ["Shoreline", "Old channel"],
  marine: ["Beach or shore", "Offshore"],
};

/** Standing structure for the class, drawn behind the zones. */
const STRUCTURES: Record<WaterType, WaterSectionSpec["structures"]> = {
  river: [
    { kind: "rock", at: { x: 0.55, y: 0.86 }, scale: 1.1 },
    { kind: "wood", at: { x: 0.17, y: 0.72 }, scale: 0.9 },
  ],
  lake: [
    { kind: "weed", at: { x: 0.3, y: 0.74 }, scale: 1.2 },
    { kind: "rock", at: { x: 0.1, y: 0.62 }, scale: 0.9 },
  ],
  reservoir: [
    { kind: "wood", at: { x: 0.34, y: 0.8 }, scale: 1 },
    { kind: "rock", at: { x: 0.06, y: 0.5 }, scale: 0.8 },
  ],
  marine: [
    { kind: "rock", at: { x: 0.3, y: 0.84 }, scale: 1.1 },
    { kind: "weed", at: { x: 0.42, y: 0.8 }, scale: 1 },
  ],
};

/**
 * A learning-level cue is one that is nearly always there in this class of
 * water, so it is drawn as likely. Anything the library holds back for a more
 * experienced reader is drawn as worth checking, which is what it is — the
 * subtle reads are exactly the ones that are not present every day.
 */
function confidenceFor(cue: ReadCue): SectionZone["confidence"] {
  return cue.level === "learning" ? "likely" : "check";
}

export function sectionFor(read: WaterRead, cues: ReadCue[]): WaterSectionSpec {
  const zones: SectionZone[] = cues
    .flatMap((c) => {
      const at = PLACEMENT[c.id];
      if (!at) return [];
      return [
        {
          id: c.id,
          label: c.title,
          why: c.why,
          at,
          confidence: confidenceFor(c),
        },
      ];
    })
    // Seven is the point at which numbered badges start colliding on a phone.
    // The rest stay in the cue list rather than being crammed into the picture.
    .slice(0, 7);

  return {
    kind: KIND[read.waterClass],
    edges: EDGES[read.waterClass],
    current: read.waterClass === "river" ? 2 : read.waterClass === "marine" ? 1 : undefined,
    thermocline: read.waterClass === "lake" || read.waterClass === "reservoir" ? 0.42 : null,
    clarity: "unknown",
    structures: STRUCTURES[read.waterClass],
    zones,
    stand: read.waterClass === "marine" ? 0.06 : 0.1,
  };
}

/**
 * The cues that could not be placed, so the plate can say what it left out
 * rather than quietly dropping them.
 */
export function unplacedCues(cues: ReadCue[]): ReadCue[] {
  return cues.filter((c) => !PLACEMENT[c.id]);
}
