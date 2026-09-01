import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
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
import { Art } from "@/components/art";
import { PLATES } from "@/lib/imagery";
import { useCompareTray, COMPARE_LIMIT } from "@/lib/compare-tray";
import { HandoffLink } from "@/components/hook-handoff";
import { useReadLevel } from "@/lib/read-level";

const JOB_IDS: JobId[] = JOBS.map((j) => j.id);

type PlanSearch = {
  job?: JobId;
  guided?: boolean;
};

function parsePlanSearch(s: Record<string, unknown>): PlanSearch {
  const raw = typeof s['job'] === "string" ? (s['job'] as string) : undefined;
  const job = raw && JOB_IDS.includes(raw as JobId) ? (raw as JobId) : undefined;
  const guided =
    s['guided'] === true || s['guided'] === "1" || s['guided'] === "true"
      ? true
      : undefined;
  const out: PlanSearch = {};
  if (job) out.job = job;
  if (guided) out.guided = guided;
  return out;
}

function gearForJob(job: JobId | undefined): GearMode {
  if (job === "kayak") return "hand_launch";
  if (job === "small_boat") return "trailer";
  return "shore_only";
}

export const Route = createFileRoute("/plan")({
  validateSearch: parsePlanSearch,
  head: () => ({
    meta: [
      { title: "Plan a Day · Field Sense Navigator" },
      {
        name: "description",
        content:
          "Declare your job and constraints — bank, kayak, small boat, scouting, tournament-adjacent or family — and rank named public waters that actually fit, then print a same-day brief.",
      },
      { property: "og:title", content: "Plan a Day · Field Sense Navigator" },
      {
        property: "og:description",
        content:
          "Situation-aware ranking of named public waters, with required-check exclusions and a printable same-day brief.",
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
      <div className="mt-3 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-3">
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
  const search = Route.useSearch();
  const [job, setJob] = useState<JobId | null>(search.job ?? null);
  const [c, setC] = useState<Constraints>(() => ({
    ...DEFAULT_CONSTRAINTS,
    gear: gearForJob(search.job),
  }));
  const [shown, setShown] = useState(9);
  const [step, setStep] = useState<1 | 2 | 3>(search.job ? (search.guided ? 3 : 2) : 1);
  const { set: setCompare } = useCompareTray();
  const { level } = useReadLevel();

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

  const STEPS = [
    { n: 1 as const, label: "Job", done: Boolean(job) },
    { n: 2 as const, label: "Constraints", done: step > 2 },
    { n: 3 as const, label: "Ranked waters", done: false },
  ];

  const jobLabel = JOBS.find((j) => j.id === job)?.label;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      {search.job ? (
        <div className="border-b border-hairline bg-brass/10">
          <p className="mx-auto max-w-7xl px-5 py-3 text-sm leading-relaxed text-foreground sm:px-8">
            Quick readiness check. Job is declared{jobLabel ? ` (${jobLabel})` : ""}.
            Constraints stay optional. Ranked waters use documented records only —
            same-day checks are not invented.
          </p>
        </div>
      ) : null}

      {/* progress rail */}
      <nav
        aria-label="Planning progress"
        className="sticky top-16 z-30 border-b border-hairline bg-abyss/85 backdrop-blur"
      >
        <ol className="mx-auto flex max-w-7xl items-stretch gap-px overflow-x-auto px-5 sm:px-8">
          {STEPS.map((s) => {
            const active = step === s.n;
            const reachable = s.n === 1 || Boolean(job);
            return (
              <li key={s.n} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => setStep(s.n)}
                  aria-current={active ? "step" : undefined}
                  className={`tap flex min-h-12 w-full items-center gap-2 border-b-2 px-3 text-left text-xs uppercase tracking-[0.12em] transition-colors disabled:opacity-40 ${
                    active
                      ? "border-brass text-brass"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="data shrink-0">{String(s.n).padStart(2, "0")}</span>
                  <span className="truncate">{s.label}</span>
                  {s.done && <Check className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* step 1 */}
      <section hidden={step !== 1} className="relative isolate overflow-hidden border-b border-hairline">
        <Art plate={PLATES.river} scrim="hero" opacity={0.9} priority />
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

          <div className="mt-10 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {JOBS.map((j) => {
              const active = job === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setJob(j.id);
                    setC((prev) => ({ ...prev, gear: gearForJob(j.id) }));
                    setShown(9);
                    setStep(2);
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
          {job && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="tap mt-8 inline-flex min-h-12 items-center gap-2 border border-brass/50 bg-brass/10 px-6 text-xs uppercase tracking-[0.14em] text-brass"
            >
              Continue to constraints
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {/* step 2 */}
      <section hidden={step !== 2} className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">STEP 02</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <h2 className="mt-6 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground">
            Constraints
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Optional. Rank with these defaults if you want the first useful list
            now. Widening later does not invent missing records.
          </p>

          <div className="mt-9 grid grid-cols-1 gap-9 lg:grid-cols-3">
            <Selector label="Time window" options={TIME_OPTIONS} value={c.timeWindow} onChange={(v) => set("timeWindow", v)} />
            <Selector label="Wind tolerance" options={WIND_OPTIONS} value={c.wind} onChange={(v) => set("wind", v)} />
            <Selector label="Gear" options={GEAR_OPTIONS} value={c.gear} onChange={(v) => set("gear", v)} />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
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

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="tap inline-flex min-h-12 items-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Change the job
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!job}
              className="tap inline-flex min-h-12 items-center gap-2 border border-brass/50 bg-brass/10 px-6 text-xs uppercase tracking-[0.14em] text-brass disabled:opacity-50"
            >
              Rank the waters
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* step 3 */}
      <section hidden={step !== 3} className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="data text-xs text-brass">STEP 03</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        {!job ? (
          <div className="mt-8">
            <EmptyState
              title="Ready to start"
              body="Nothing has been ranked yet. Tell us what kind of day you are planning — we will not invent one to fill the page. Next: pick bank, kayak, or small boat — or browse the catalog."
              action={
                <div className="flex flex-wrap justify-center gap-4">
                  <Link to="/plan" search={{ job: "bank" }} className="tick text-brass">
                    Start with a bank job →
                  </Link>
                  <Link to="/explore" className="tick text-primary hover:text-brass">
                    Or browse the full catalog →
                  </Link>
                </div>
              }
            />
          </div>
        ) : result && result.fits.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No water meets these requirements"
              body="With these constraints no record can be recommended without inventing something we do not hold. Widen the gear mode, the states, or the water type — this guide will not soften a required check to fill the page."
              action={
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="tick text-brass"
                >
                  Change a constraint →
                </button>
              }
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
                required checks
              </p>
            </div>

            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Fit score blends documented readiness with how well the record
              matches this job and these constraints. It is a documentation
              judgement, not a prediction about the day.
            </p>

            <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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

            {/* what to do with the ranking */}
            {result.fits[0] && (
              <div className="rule-top mt-12 pt-8">
                <p className="tick text-brass">Take it forward</p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  A ranking is not a decision. Put the shortlist side by side,
                  or take the top record straight to a same-day brief — then
                  hand the water to the instrument that answers the next
                  question.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCompare(
                        result.fits
                          .slice(0, COMPARE_LIMIT)
                          .map((f) => f.destination.id),
                      )
                    }
                    className="tap inline-flex min-h-12 items-center border border-brass/50 bg-brass/10 px-5 text-xs uppercase tracking-[0.14em] text-brass hover:bg-brass/20"
                  >
                    Compare the top {Math.min(COMPARE_LIMIT, result.fits.length)}
                  </button>
                  <Link
                    to="/compare"
                    className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
                  >
                    Open the comparison
                  </Link>
                  <Link
                    to="/packet/$id"
                    params={{ id: result.fits[0].destination.id }}
                    search={job ? { job } : {}}
                    className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
                  >
                    Brief for the top record
                  </Link>
                  <HandoffLink
                    destination={result.fits[0].destination}
                    target="ops"
                    context={{ job, level }}
                    className="tap inline-flex min-h-12 items-center border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
                  >
                    Turn it into a trip ↗
                  </HandoffLink>
                </div>
              </div>
            )}

            {result.excluded.length > 0 && (
              <div className="mt-16">
                <p className="tick text-alert">
                  Not a match for this plan ({result.excluded.length})
                </p>
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  These waters are not ranked because a required check could not be
                  cleared from the record. They are shown so the exclusion is
                  visible rather than silent.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {result.excluded.slice(0, 9).map((f) => (
                    <BlockedCard key={f.destination.id} fit={f} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
