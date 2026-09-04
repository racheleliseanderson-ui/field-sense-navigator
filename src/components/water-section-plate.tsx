import { useMemo } from "react";

import { PlateDepthControl, WaterSectionPlate } from "@/lib/field-plates";
import { sectionFor, unplacedCues } from "@/lib/water-section";
import { cuesFor, readWater, type ReadLevel } from "@/lib/water-reading";
import type { Destination } from "@/lib/catalog";

/**
 * The standing read, drawn.
 *
 * The cue list answers what to look for and why fish relate to it. This
 * answers the question a beginner asks immediately and rarely says out loud:
 * where is that, exactly. Both are needed — a section with no reasoning is a
 * picture, and reasoning with no section is a paragraph somebody reads twice
 * and still cannot use standing on a bank.
 */
export function WaterSectionReading({
  destination,
  level,
}: {
  destination: Destination;
  level: ReadLevel;
}) {
  const read = useMemo(() => readWater(destination), [destination]);
  const cues = useMemo(() => cuesFor(read, level), [read, level]);
  const spec = useMemo(() => sectionFor(read, cues), [read, cues]);
  const left = useMemo(() => unplacedCues(cues), [cues]);

  if (!spec.zones?.length) return null;

  return (
    <div className="hthp-stack">
      {/* Beside the drawing rather than in a settings drawer: it changes what
          is on this screen, and a control for that belongs next to it. */}
      <PlateDepthControl />
      <WaterSectionPlate
        spec={spec}
        title={read.headline}
        caption={`A section through water of this class, near side on the left. It is craft, not a survey of ${destination.waterbody} — the shape of this particular bank is yours to read when you get there.`}
        testid="water-section-reading"
        unknown={
          left.length
            ? `Not drawn: ${left
                .map((c) => c.title.toLowerCase())
                .join(
                  ", ",
                )}. Those describe the whole system rather than a place in it, and putting them somewhere on this picture would be inventing a location to make it look fuller.`
            : undefined
        }
        aside={
          <>
            <p>
              Solid zones are features this class of water nearly always has. Dashed ones are the
              subtler reads — present often enough to look for, not often enough to assume.
            </p>
            <p>
              Nothing here is an observation of today. No gauge reading, no clarity, no temperature
              and no fish went into this drawing. It is the same standing craft an angler carries
              between waters, and the water in front of you outranks all of it.
            </p>
          </>
        }
      />
    </div>
  );
}
