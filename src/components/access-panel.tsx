import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

import { ACCESS_KIND_LABEL, ACCESS_KIND_NOTE, readAccess, type AccessKind } from "@/lib/access";
import type { Destination } from "@/lib/catalog";
import { GradeChip } from "@/components/instrument";

const ORDER: AccessKind[] = ["trailer_launch", "hand_launch", "pier", "shore", "directory"];

/**
 * Access, launches and logistics.
 *
 * The record already carried named facilities and the agency's own amenity
 * wording; until now only the count reached the page. This section puts the
 * facilities, their published status and the logistics you plan around in
 * front of the reader, and says plainly where the source went quiet.
 */
export function AccessPanel({ destination }: { destination: Destination }) {
  const a = useMemo(() => readAccess(destination), [destination]);

  return (
    <section aria-labelledby="access-heading" className="min-w-0">
      <div className="flex items-center gap-4">
        <span className="h-px w-10 bg-brass" />
        <p className="tick text-brass">Getting on the water</p>
      </div>
      <h2
        id="access-heading"
        className="mt-5 font-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground"
      >
        Access &amp; launches
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{a.readout}</p>

      {/* how you can get on */}
      <ul className="mt-7 flex flex-wrap gap-px bg-hairline">
        {ORDER.filter((k) => a.counts[k] > 0).map((k) => (
          <li key={k} className="min-w-[15rem] flex-1 bg-card px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{ACCESS_KIND_LABEL[k]}</p>
              <p className="data text-lg text-brass">{a.counts[k]}</p>
            </div>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
              {ACCESS_KIND_NOTE[k]}
            </p>
          </li>
        ))}
        {ORDER.every((k) => a.counts[k] === 0) && (
          <li className="min-w-[15rem] flex-1 bg-card px-4 py-4 text-sm text-muted-foreground">
            The official source names no access facility of a recognised type for this record.
            Nothing is assumed in its place.
          </li>
        )}
      </ul>

      {/* logistics the record supports */}
      {a.logistics.length > 0 && (
        <div className="mt-8">
          <p className="tick text-[0.55rem]">Logistics named on the official source</p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {a.logistics.map((l) => (
              <li key={l.id} className="border-l border-brass/50 pl-3">
                <p className="text-sm font-medium text-foreground">{l.label}</p>
                <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
                  {l.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* the sites themselves */}
      {a.sites.length > 0 && (
        <div className="mt-8">
          <p className="tick text-[0.55rem]">Named public sites ({a.sites.length})</p>
          <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
            {a.sites.map((s, i) => (
              <li key={`${s.name}-${i}`} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-foreground">{s.name}</p>
                    <p className="tick mt-1 text-[0.55rem]">{s.typeLabel}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {s.open === false && <GradeChip grade="restricted" label="Documented closed" />}
                    {s.open === true && <GradeChip grade="clear" label={s.statusLabel ?? "Open"} />}
                    {s.open === null && (
                      <span className="tick border border-hairline px-2 py-1 text-[0.55rem]">
                        Status not stated
                      </span>
                    )}
                    {s.seasonal && <GradeChip grade="watch" label="Seasonal" />}
                  </div>
                </div>
                {s.amenities.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Published amenities">
                    {s.amenities.map((x) => (
                      <li
                        key={x}
                        className="border border-hairline bg-background/60 px-2 py-0.5 text-[0.62rem] text-muted-foreground"
                      >
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
                {!s.published && (
                  <p className="mt-2 text-[0.68rem] leading-relaxed text-alert">
                    Not marked as officially published on this record — confirm it with the managing
                    agency before you rely on it.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
            Facility names and amenity wording are reproduced from the official source, not
            restated. Where a status is not shown, the source did not publish one.
          </p>
        </div>
      )}

      {a.directoryOnly && (
        <div className="mt-6 border border-watch/40 bg-watch/[0.08] px-4 py-3">
          <p className="tick text-watch">Choose a site before you travel</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            This record covers an official directory of access sites rather than one place. Pick a
            named site from the official source and write it down — a network is not a destination.
          </p>
          <a
            href={destination.officialSourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="tap mt-3 inline-flex min-h-11 items-center border border-hairline px-4 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
          >
            Open the official directory ↗
          </a>
        </div>
      )}

      <div className="rule-top mt-8 pt-5">
        <p className="tick text-alert">What this section cannot tell you</p>
        <ul className="mt-3 space-y-2">
          {a.unknowns.map((u) => (
            <li key={u} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-px w-4 shrink-0 bg-alert" />
              {u}
            </li>
          ))}
        </ul>
        <Link
          to="/explore"
          search={{ state: destination.state, access: "boat launch" }}
          className="tick tap mt-4 inline-flex min-h-11 items-center text-primary hover:text-brass"
        >
          Find other launch-capable water in {destination.state} →
        </Link>
      </div>
    </section>
  );
}
