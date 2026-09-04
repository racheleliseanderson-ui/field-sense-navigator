import { useMemo, useState } from "react";

import { eventsFor, sharpenedFor, type ConditionEvent } from "@/lib/condition-response";
import type { Destination } from "@/lib/catalog";
import type { ReadLevel } from "@/lib/water-reading";

/**
 * What changes when the water changes.
 *
 * The standing read answers "what is a seam". This answers the question an
 * angler who already knows that actually asks: it rained on Tuesday, what does
 * that do. They ran the dam this morning. The wind swung north. The reservoir
 * is twenty feet down.
 *
 * The angler picks the event, because nothing here reads a gauge and nothing
 * here is going to pretend to. Every entry says how long the change lasts,
 * how to confirm it standing there, and — the part that matters most — what it
 * does *not* change. One moving variable rewriting the whole day is the
 * commonest failure in fishing advice, and the guard against it belongs in the
 * same panel as the advice.
 */
export function ConditionResponsePanel({
  destination,
  level,
}: {
  destination: Destination;
  level: ReadLevel;
}) {
  const events = useMemo(
    () => eventsFor(destination.waterType, level),
    [destination.waterType, level],
  );
  const sharp = useMemo(() => new Set(sharpenedFor(destination)), [destination]);
  const [open, setOpen] = useState<ConditionEvent | null>(null);

  if (!events.length) return null;

  /* Events this record has a specific reason to care about come first. */
  const ordered = [...events].sort(
    (a, b) => Number(sharp.has(b.event)) - Number(sharp.has(a.event)),
  );

  return (
    <section aria-labelledby="change-heading" className="min-w-0">
      <div className="flex items-center gap-4">
        <span className="h-px w-10 bg-brass" />
        <p className="tick text-brass">When the water changes</p>
      </div>
      <h2
        id="change-heading"
        className="mt-5 font-display text-[clamp(1.5rem,3vw,2.2rem)] font-bold tracking-[-0.03em] text-foreground"
      >
        It rained. They ran the dam. The wind swung.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Pick what actually happened. Nothing here reads a gauge — you supply the event, from your
        own eyes or the agency's page, and this says what it does to water of this class.
      </p>

      <ul className="mt-6 grid gap-px bg-hairline sm:grid-cols-2">
        {ordered.map((e) => {
          const isOpen = open === e.event;
          return (
            <li key={`${e.event}-${e.label}`} className="bg-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : e.event)}
                aria-expanded={isOpen}
                className="tap flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-panel"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{e.label}</span>
                  <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted-foreground">
                    {e.question}
                  </span>
                </span>
                {sharp.has(e.event) ? (
                  <span className="tick shrink-0 text-[0.5rem] text-brass">This water</span>
                ) : null}
              </button>

              {isOpen ? (
                <div className="border-t border-hairline px-4 py-4">
                  <p className="text-sm leading-relaxed text-foreground">{e.headline}</p>

                  <ol className="mt-4 space-y-4">
                    {e.notes.map((n) => (
                      <li key={n.id} className="border-l-2 border-brass/40 pl-3">
                        <p className="text-sm leading-relaxed text-foreground/90">{n.what}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="tick text-[0.5rem] text-brass">Where</span> {n.where}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          <span className="tick text-[0.5rem] text-brass">Confirm it</span>{" "}
                          {n.confirm}
                        </p>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 grid gap-3 border-t border-hairline pt-3 sm:grid-cols-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="tick text-[0.5rem] text-brass">How long</span> {e.window}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="tick text-[0.5rem] text-alert">Does not change</span>{" "}
                      {e.doesNotChange}
                    </p>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border border-alert/30 bg-alert/[0.06] px-4 py-3">
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="tick text-alert">Still craft, not observation</span> — this is what these
          changes do to a {destination.waterType}. It does not know whether any of them happened
          here, and it never will. The agency's page and your own eyes are the only things that do.
        </p>
      </div>
    </section>
  );
}
