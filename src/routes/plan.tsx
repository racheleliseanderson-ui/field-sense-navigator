import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { WaterCard, BlockedCard } from "@/components/water-card";
import { EmptyState } from "@/components/instrument";
import { destinations, states, waterTypes } from "@/lib/catalog";
import {
  DEFAULT_CONSTRAINTS,
  JOBS,
  rank,
  type Constraints,
  type GearMode,
  type JobId,
  type TimeWindow,
  type WindTolerance,
} from "@/lib/intelligence";
import riverImg from "@/assets/river.jpg";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan a Day · Honey Hole Intelligence" },
      {
        name: "description",
        content:
          "Declare your job and constraints — bank, kayak, small boat, scouting, tournament-adjacent or family — and rank named public waters that actually fit, then print a field packet.",
      },
      { property: "og:title", content: "Plan a Day · Honey Hole Intelligence" },
      {
        property: "og:description",
        content:
          "Situation-aware ranking of named public waters, with fail-closed exclusions and a printable same-day field packet.",
      },
    ],
  }),
  component: Plan,
});

const TIME_OPTIONS: Array<{ id: TimeWindow; label: string; note: string }> = [
  { id: "short", label: "Short window", note: "Under four hours on the water" },
  { id: "day", label: "Full day", note: "One travel day, one water" },
  { id: "multi", label: "Multi-day", note: "Room to move between accesses" },
];

const WIND_OPTIONS: Array<{ id: WindTolerance; label: string; note: string }> = [
  { id: "low", label: "Low", note: "Avoid documented fetch and big water" },
  { id: "moderate", label: "Moderate", note: "Willing to work a protected side" },
  { id: "high", label: "High", note: "Rigged and crewed for rough water" },
];

const GEAR_OPTIONS: Array<{ id: GearMode; label: string; note: string }> = [
  { id: "shore_only", label: "Shore only", note: "On foot, public frontage required" },
  { id: "hand_launch", label: "Hand launch", note: "Kayak, canoe or cartop craft" },
  { id: "trailer", label: "Trailered boat", note: "Needs an open hard-surface ramp" },
];

function Selector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string; note: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="tick">{label}</legend>
      <div className="mt-3 grid gap-px bg-hairline sm:grid-cols-3">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={active}
              className={`px-4 py-4 text-left transition-colors ${
                active ? "bg-brass/15" : "bg-card hover:bg-panel"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  active ? "text-brass" : "text-foreground"
                }`}
              >
                {o.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {o.note}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Plan() {
  const [job, setJob] = useState<JobId | null>(null);
  const [c, setC] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [shown, setShown] = useState(9);

  const result = useMemo(
    () => (job ? rank(destinations, job, c) : null),
    [job, c],
  );

  const set = <K extends keyof Constraints>(k: K, v: Constraints[K]) => {
    setC((prev) => ({ ...prev, [k]: v }));
    setShown(9);
  };

  const toggleList = (k: "states" | "waterTypes", v: string) =>
    setC((prev) => ({
      ...prev,
      [k]: prev[k].includes(v) ? prev[k].filter((x) => x !== v) : [...prev[k], v],
    }));

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      {/* step 1 */}
      <section className="relative isolate overflow-hidden border-b border-hairline">
        <img
          src={riverImg}
          alt="Cold river current running past a wet gravel bar at dawn"
          width={1280}
          height={960}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-abyss/85 via-abyss/70 to-background" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">STEP 01</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.2rem,5.6vw,4.4rem)] font-bold leading-[0.92] tracking-[-0.04em] text-foreground">
            What job are you
            <br />
            actually doing?
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Ranking changes completely with the job. A water that is excellent
            for a trailered boat can be the wrong answer entirely for a kayak or
            a family afternoon.
          </p>

          <div className="mt-10 grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {JOBS.map((j) => {
              const active = job === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setJob(j.id);
                    setShown(9);
                  }}
                  aria-pressed={active}
                  className={`group relative px-6 py-7 text-left transition-colors ${
                    active ? "bg-brass/15" : "bg-card hover:bg-panel"
                  }`}
                >
                  <span
                    className={`font-display text-lg font-bold tracking-tight ${
                      active ? "text-brass" : "text-foreground"
                    }`}
                  >
                    {j.label}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {j.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* step 2 */}
      <section className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">STEP 02</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <h2 className="mt-6 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground">
            Constraints
          </h2>

          <div className="mt-9 grid gap-9 lg:grid-cols-3">
            <Selector label="Time window" options={TIME_OPTIONS} value={c.timeWindow} onChange={(v) => set("timeWindow", v)} />
            <Selector label="Wind tolerance" options={WIND_OPTIONS} value={c.wind} onChange={(v) => set("wind", v)} />
            <Selector label="Gear" options={GEAR_OPTIONS} value={c.gear} onChange={(v) => set("gear", v)} />
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <p className="tick">Water type (optional)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {waterTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleList("waterTypes", t)}
                    className={`border px-3 py-1.5 text-xs transition-colors ${
                      c.waterTypes.includes(t)
                        ? "border-brass/60 bg-brass/15 text-brass"
                        : "border-hairline text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="tick">States (optional)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {states.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleList("states", s)}
                    className={`border px-2.5 py-1.5 text-xs transition-colors ${
                      c.states.includes(s)
                        ? "border-brass/60 bg-brass/15 text-brass"
                        : "border-hairline text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* step 3 */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="data text-xs text-brass">STEP 03</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        {!job ? (
          <div className="mt-8">
            <EmptyState
              title="Declare a job to begin the ranking"
              body="Nothing is ranked until the instrument knows what you are trying to do. Until then the catalog stays alphabetically indifferent — and that is the state this tool exists to replace."
              action={
                <Link to="/explore" className="tick text-primary hover:text-brass">
                  Or browse the full catalog →
                </Link>
              }
            />
          </div>
        ) : result && result.fits.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Every candidate failed closed"
              body="With these constraints no record can be recommended without inventing something we do not hold. Widen the gear mode, the states, or the water type — the instrument will not soften the gate to fill the page."
            />
          </div>
        ) : result ? (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
              <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground">
                Ranked for {JOBS.find((j) => j.id === job)?.label.toLowerCase()}
              </h2>
              <p className="data text-xs text-muted-foreground">
                {result.fits.length} fit · {result.excluded.length} excluded by
                fail-closed gates
              </p>
            </div>

            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Fit score blends documented readiness with how well the record
              matches this job and these constraints. It is a documentation
              judgement, not a prediction about the day.
            </p>

            <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {result.fits.slice(0, shown).map((f, i) => (
                <WaterCard
                  key={f.destination.id}
                  destination={f.destination}
                  fit={f}
                  rank={i + 1}
                />
              ))}
            </div>

            {shown < result.fits.length && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShown((s) => s + 9)}
                  className="border border-hairline px-8 py-4 text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                >
                  Show more candidates
                </button>
              </div>
            )}

            {result.excluded.length > 0 && (
              <div className="mt-16">
                <p className="tick text-alert">
                  Excluded — fail closed ({result.excluded.length})
                </p>
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  These waters are not ranked because a hard gate could not be
                  cleared from the record. They are shown so the exclusion is
                  visible rather than silent.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {result.excluded.slice(0, 9).map((f) => (
                    <BlockedCard key={f.destination.id} fit={f} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      <SiteFooter />
    </div>
  );
}