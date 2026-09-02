import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import type { Destination } from "@/lib/catalog";
import type { HandoffContext, HandoffTarget } from "@/lib/handoff";
import { useHandoffSteps, useHandoffTemperature, useHandoffUrl } from "@/lib/use-handoff";

/**
 * Water → Species → Forage/Hatch → Presentation → Rig/Tackle → Knot → Field Ops.
 *
 * Field Sense answers the first question in the Hook workflow. These are the
 * instruments that answer the next ones, in order, each carrying this water's
 * class, documented species, standing read, access position and declared job
 * so the reader never starts from zero. Nothing is posted automatically — a
 * handoff is a link the reader presses, and the packet travels in the URL
 * fragment, which never reaches a server.
 */
export function HookHandoff({
  destination,
  context = {},
  species,
  onSpecies,
  compact = false,
  live = true,
}: {
  destination: Destination;
  context?: HandoffContext;
  /** Currently selected species, if the page offers the choice. */
  species?: string | null;
  onSpecies?: (s: string | null) => void;
  compact?: boolean;
  /**
   * Attach the official temperature to every packet. On by default: this
   * component only appears on a single-water page, where it shares the live
   * query with the conditions panel and costs no extra request.
   */
  live?: boolean;
}) {
  const temperature = useHandoffTemperature(destination, live);
  const ctx: HandoffContext = useMemo(
    () => ({ ...context, species: species ?? context.species ?? null, temperature }),
    [context, species, temperature],
  );
  const steps = useHandoffSteps(destination, ctx);

  if (compact) {
    return (
      <ul className="mt-3 space-y-1">
        {steps.map((s, i) => (
          <li key={s.id}>
            <a
              href={s.url}
              className="tap flex min-h-12 items-center gap-3 border border-hairline px-3 text-left transition-colors hover:border-brass/60 hover:bg-brass/[0.06]"
            >
              <span className="data shrink-0 text-[0.62rem] text-brass">
                {String(i + 2).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{s.step}</span>
                <span className="block truncate text-[0.62rem] text-muted-foreground">{s.app}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="handoff-heading" data-print="hide" className="min-w-0">
      <div className="flex items-center gap-4">
        <span className="h-px w-10 bg-brass" />
        <p className="tick text-brass">Hook the Horizon · the next step</p>
      </div>
      <h2
        id="handoff-heading"
        className="mt-5 font-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground"
      >
        Carry this water forward
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        You have answered where and what kind of water. Each instrument below answers the next
        question in the same workflow, and each link carries this record's water class, documented
        species, standing read, access position and declared job with it. Nothing is posted
        automatically, and no coordinates or private water travel in the handoff.
      </p>

      {onSpecies && destination.speciesContext.length > 0 && (
        <div className="mt-6">
          <p className="tick text-[0.55rem]">
            Narrow the handoff to one documented species (optional)
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {destination.speciesContext.map((s) => {
              const on = species === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => onSpecies(on ? null : s)}
                    aria-pressed={on}
                    className={`tap inline-flex min-h-11 items-center border px-3 text-xs transition-colors ${
                      on
                        ? "border-brass/60 bg-brass/15 text-brass"
                        : "border-hairline text-muted-foreground hover:border-brass/40 hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
            Species context is what the agency published for this water. It is never a statement
            that a fish is present today, or catchable.
          </p>
        </div>
      )}

      <ol className="mt-8 grid grid-cols-1 gap-px bg-hairline">
        <li className="bg-abyss/60 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="data text-xs text-brass">01</span>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              Water
            </span>
            <span className="tick text-[0.55rem] text-brass">You are here</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Field Sense Navigator — which water, what kind, what to look for and what still has to
            be checked today.
          </p>
        </li>
        {steps.map((s, i) => (
          <li key={s.id} className="bg-card">
            <a
              href={s.url}
              className="tap group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-panel"
            >
              <span className="data mt-1 shrink-0 text-xs text-brass">
                {String(i + 2).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-base font-bold tracking-tight text-foreground group-hover:text-brass">
                    {s.step}
                  </span>
                  <span className="tick text-[0.55rem]">{s.app}</span>
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-foreground/85">
                  {s.question}
                </span>
                <span className="mt-1.5 block text-[0.7rem] leading-relaxed text-muted-foreground">
                  {s.why}
                </span>
              </span>
              <ArrowUpRight
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brass"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * A single handoff link. Use this rather than building the URL inline: the
 * packet carries a timestamp, so the href can only be attached after mount
 * without tripping a hydration mismatch.
 */
export function HandoffLink({
  destination,
  target,
  context = {},
  className = "",
  children,
  live = false,
}: {
  destination: Destination;
  target: HandoffTarget;
  context?: HandoffContext;
  className?: string;
  children: React.ReactNode;
  /**
   * Off by default. List pages render one of these per record, and a live
   * pull per card is not a trade worth making for a link the reader may
   * never press. Single-record pages turn it on.
   */
  live?: boolean;
}) {
  const temperature = useHandoffTemperature(destination, live);
  const url = useHandoffUrl(destination, target, {
    ...context,
    ...(live ? { temperature } : {}),
  });
  return (
    <a href={url} className={className}>
      {children}
    </a>
  );
}
