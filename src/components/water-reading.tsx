import { useMemo } from "react";

import type { Destination } from "@/lib/catalog";
import { useReadLevel } from "@/lib/read-level";
import { FAMILY_LABEL, READ_LEVELS, cuesFor, readWater, type ReadLevel } from "@/lib/water-reading";
import { WaterSectionReading } from "@/components/water-section-plate";

/** Beginner → competent → advanced, as one setting the reader controls. */
export function ReadLevelControl({
  level,
  setLevel,
  className = "",
}: {
  level: ReadLevel;
  setLevel: (l: ReadLevel) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="tick text-[0.55rem]">Detail</legend>
      <div className="mt-2 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-3">
        {READ_LEVELS.map((l) => {
          const active = level === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              aria-pressed={active}
              className={`tap min-h-12 px-3 py-2 text-left transition-colors ${
                active ? "bg-selected" : "bg-card hover:bg-panel"
              }`}
            >
              <span
                className={`block text-sm font-medium ${active ? "text-selected-foreground" : "text-foreground"}`}
              >
                {l.label}
              </span>
              <span
                className={`mt-0.5 block text-[0.66rem] leading-snug ${active ? "text-selected-muted" : "text-muted-foreground"}`}
              >
                {l.note}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Reading this water" — the craft layer.
 *
 * It sits apart from the five documented layers on purpose. Those five report
 * what an agency published about this water. This one reports what any angler
 * should look for on this CLASS of water, ordered by what the record happens
 * to document. It is never presented as an observation of the water today.
 */
export function WaterReadingPanel({ destination }: { destination: Destination }) {
  const { level, setLevel } = useReadLevel();
  const read = useMemo(() => readWater(destination), [destination]);
  const cues = cuesFor(read, level);

  return (
    <section aria-labelledby="reading-heading" className="min-w-0">
      <div className="flex items-center gap-4">
        <span className="h-px w-10 bg-brass" />
        <p className="tick text-brass">Reading this water</p>
      </div>
      <h2
        id="reading-heading"
        className="mt-5 font-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground"
      >
        {read.headline}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{read.summary}</p>

      <div className="mt-6 border border-alert/30 bg-alert/[0.06] px-4 py-3">
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="tick text-alert">Craft, not observation</span> — this is the standing
          read for a {read.waterClass}. It holds no clarity, temperature, level, flow, tide or hatch
          for this water today, and it does not name a spot.
        </p>
      </div>

      <div className="mt-6">
        <WaterSectionReading destination={destination} level={level} />
      </div>

      <ReadLevelControl level={level} setLevel={setLevel} className="mt-7 max-w-2xl" />

      {read.shaped.length > 0 && (
        <div className="mt-8">
          <p className="tick text-[0.55rem]">What this record changes about the read</p>
          <ul className="mt-3 space-y-2.5">
            {read.shaped.map((s) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                <span className="mt-2.5 h-px w-4 shrink-0 bg-brass" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {level === "learning" && (
        <div className="panel mt-8 p-5">
          <p className="tick text-brass">Start here</p>
          <ol className="mt-3 space-y-2.5">
            {read.firstMoves.map((m, i) => (
              <li key={m} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span className="data shrink-0 text-xs text-brass">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {m}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
        {cues.map((c) => (
          <article key={c.id} className="bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tick text-[0.5rem] text-brass">{FAMILY_LABEL[c.family]}</span>
              {c.level === "advanced" && (
                <span className="tick border border-hairline px-1.5 text-[0.5rem]">Advanced</span>
              )}
            </div>
            <h3 className="mt-2 font-display text-base font-bold tracking-tight text-foreground">
              {c.title}
            </h3>
            <dl className="mt-3 space-y-2.5">
              <div>
                <dt className="tick text-[0.5rem]">What it is</dt>
                <dd className="mt-1 text-sm leading-relaxed text-foreground/85">{c.what}</dd>
              </div>
              <div>
                <dt className="tick text-[0.5rem]">Why fish hold there</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.why}</dd>
              </div>
              <div>
                <dt className="tick text-[0.5rem]">How to find it</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.look}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {level !== "advanced" && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {read.cues.length - cues.length} further cue
          {read.cues.length - cues.length === 1 ? "" : "s"} for this water class are held at a
          higher detail setting.
        </p>
      )}

      <div className="rule-top mt-8 pt-5">
        <p className="tick text-alert">What this read cannot tell you</p>
        <ul className="mt-3 space-y-2">
          {read.limits.map((l) => (
            <li key={l} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-px w-4 shrink-0 bg-alert" />
              {l}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
