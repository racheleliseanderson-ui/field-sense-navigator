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
  /*
   * Fractions of the *water*, not of the frame: 0 is the near waterline and
   * the surface. They are fitted to the bed profile the plate draws for each
   * class, so a zone lands in water rather than inside the bank — the section
   * paints the ground last precisely so a bad placement shows up as a zone cut
   * in half instead of one floating through a gravel bar.
   */

  /* River: shallow shelf where you are standing, slot toward the far bank. */
  seam: { x: 0.36, y: 0.05, w: 0.16, h: 0.52 },
  "outside-bend": { x: 0.58, y: 0.28, w: 0.24, h: 0.5 },
  eddy: { x: 0.02, y: 0.01, w: 0.14, h: 0.12 },
  confluence: { x: 0.76, y: 0.0, w: 0.2, h: 0.24 },
  wood: { x: 0.14, y: 0.08, w: 0.18, h: 0.3 },
  drop: { x: 0.46, y: 0.4, w: 0.2, h: 0.44 },
  foam: { x: 0.3, y: 0.0, w: 0.3, h: 0.08 },
  hydraulics: { x: 0.5, y: 0.6, w: 0.18, h: 0.26 },
  "riffle-run-pool": { x: 0.2, y: 0.3, w: 0.24, h: 0.24 },

  /* Lake: a shelf, one break, then a basin that stops getting deeper. */
  flat: { x: 0.03, y: 0.01, w: 0.22, h: 0.09 },
  points: { x: 0.08, y: 0.02, w: 0.16, h: 0.18 },
  "weed-edge": { x: 0.24, y: 0.08, w: 0.16, h: 0.24 },
  breakline: { x: 0.36, y: 0.2, w: 0.14, h: 0.6 },
  inflow: { x: 0.0, y: 0.0, w: 0.13, h: 0.09 },
  cover: { x: 0.12, y: 0.06, w: 0.14, h: 0.16 },
  thermal: { x: 0.55, y: 0.38, w: 0.42, h: 0.13 },

  /* Reservoir: the same shelf, read against the flooded channel. */
  channel: { x: 0.6, y: 0.5, w: 0.28, h: 0.38 },
  "arm-point": { x: 0.06, y: 0.02, w: 0.2, h: 0.18 },
  timber: { x: 0.3, y: 0.16, w: 0.16, h: 0.34 },
  riprap: { x: 0.0, y: 0.02, w: 0.13, h: 0.2 },
  "inflow-colour": { x: 0.8, y: 0.0, w: 0.18, h: 0.2 },
  bluff: { x: 0.84, y: 0.1, w: 0.15, h: 0.55 },

  /* Inshore: flats, then the channel cut through them. */
  surf: { x: 0.0, y: 0.0, w: 0.2, h: 0.2 },
  "channel-edge": { x: 0.42, y: 0.15, w: 0.18, h: 0.62 },
  "hard-structure": { x: 0.2, y: 0.02, w: 0.16, h: 0.15 },
  rips: { x: 0.62, y: 0.0, w: 0.24, h: 0.13 },
  "bottom-change": { x: 0.66, y: 0.05, w: 0.26, h: 0.12 },
  "bait-birds": { x: 0.7, y: 0.0, w: 0.26, h: 0.07 },
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
    { kind: "rock", at: { x: 0.6, y: 0.78 }, scale: 1.1 },
    { kind: "wood", at: { x: 0.28, y: 0.4 }, scale: 0.9 },
  ],
  lake: [
    { kind: "weed", at: { x: 0.2, y: 0.19 }, scale: 1.2 },
    { kind: "rock", at: { x: 0.42, y: 0.5 }, scale: 0.9 },
  ],
  reservoir: [
    { kind: "wood", at: { x: 0.34, y: 0.36 }, scale: 1 },
    { kind: "rock", at: { x: 0.08, y: 0.18 }, scale: 0.8 },
  ],
  marine: [
    { kind: "rock", at: { x: 0.5, y: 0.6 }, scale: 1.1 },
    { kind: "weed", at: { x: 0.26, y: 0.14 }, scale: 1 },
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
