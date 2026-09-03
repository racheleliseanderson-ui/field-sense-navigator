/**
 * Art direction — one source of truth for every photograph in the instrument.
 *
 * Six plates, each shot to the same brief: deep navy / slate water, one held
 * band of brass light, fine grain, no people, no text. Two renditions per
 * plate (2400w for desktop heroes, 1200w for phones) so a mobile visit never
 * downloads the desktop file. All WebP; total catalogue under 1 MB.
 */
import heroL from "@/assets/hero.webp";
import heroM from "@/assets/hero-m.webp";
import riverL from "@/assets/river.webp";
import riverM from "@/assets/river-m.webp";
import flatsL from "@/assets/flats.webp";
import flatsM from "@/assets/flats-m.webp";
import rampL from "@/assets/ramp.webp";
import rampM from "@/assets/ramp-m.webp";
import lakeL from "@/assets/lake.webp";
import lakeM from "@/assets/lake-m.webp";
import stillL from "@/assets/still.webp";
import stillM from "@/assets/still-m.webp";

export type Plate = {
  /** 2400px rendition */
  src: string;
  /** responsive set: 1200w + 2400w */
  srcSet: string;
  alt: string;
  /** where the brass light sits, so crops keep it in frame */
  position: string;
};

const plate = (l: string, m: string, alt: string, position = "center"): Plate => ({
  src: l,
  srcSet: `${m} 1200w, ${l} 2400w`,
  alt,
  position,
});

export const PLATES = {
  hero: plate(
    heroL,
    heroM,
    "Wind-scoured open water rolling beneath a storm shelf, one brass band of first light on the horizon",
    "center 62%",
  ),
  river: plate(
    riverL,
    riverM,
    "A braided river corridor past a gravel bar, a single shaft of dawn light cutting through the mist",
    "center 55%",
  ),
  flats: plate(
    flatsL,
    flatsM,
    "Tidal flats at low water, serpentine channels catching bronze light beneath a distant squall",
    "center 60%",
  ),
  ramp: plate(
    rampL,
    rampM,
    "An empty concrete boat ramp descending into a mirror-still reservoir at blue hour",
    "center 70%",
  ),
  lake: plate(
    lakeL,
    lakeM,
    "A mirror-calm forested lake in morning fog, light breaking low at the far shore",
    "center 45%",
  ),
  still: plate(
    stillL,
    stillM,
    "A brass compass on folded tide tables beside a leather field notebook, lit by one low window",
    "center",
  ),
} as const;

/** Hero sizes hint: full-bleed on every viewport. */
export const FULL_BLEED = "100vw";
/** Half-width split panels on desktop, full-bleed on phones. */
export const HALF_BLEED = "(min-width: 768px) 50vw, 100vw";
/** Card thumbnails: a third of the container on desktop. */
export const CARD = "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw";

/** Which plate represents a water type on records and cards. */
export function plateFor(waterType: string): Plate {
  switch (waterType) {
    case "marine":
      return PLATES.flats;
    case "river":
      return PLATES.river;
    case "reservoir":
      return PLATES.ramp;
    case "lake":
      return PLATES.lake;
    default:
      return PLATES.hero;
  }
}
