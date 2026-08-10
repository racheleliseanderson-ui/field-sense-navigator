import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Check, Copy, Printer } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { GradeChip, LayerPanel, ReadinessMeter } from "@/components/instrument";
import {
  destinationById,
  displayName,
  humanize,
  daysSince,
  reviewOverdue,
  type Destination,
} from "@/lib/catalog";
import {
  JOBS,
  buildHandoff,
  buildLayers,
  readiness,
  type JobId,
} from "@/lib/intelligence";
import heroImg from "@/assets/hero-water.jpg";
import riverImg from "@/assets/river.jpg";
import flatsImg from "@/assets/flats.jpg";
import rampImg from "@/assets/ramp.jpg";

function imageFor(d: Destination) {
  if (d.waterType === "marine") return flatsImg;
  if (d.waterType === "river") return riverImg;
  if (d.waterType === "reservoir") return rampImg;
  return heroImg;
}

export const Route = createFileRoute("/water/$id")({
  loader: ({ params }) => {
    const d = destinationById(params.id);
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    const name = loaderData ? displayName(loaderData) : "Water record";
    const place = loaderData ? `${loaderData.region}, ${loaderData.state}` : "";
    return {
      meta: [
        { title: `${name} · Honey Hole Intelligence` },
        {
          name: "description",
          content: `Layered public-waters intelligence for ${name} in ${place}: access and legality, hazards, capacity, regulatory pressure and same-day field checks.`,
        },
        { property: "og:title", content: `${name} · Honey Hole Intelligence` },
        {
          property: "og:description",
          content: `Field readiness, documented signals and residual unknowns for ${name}. Public waters only.`,
        },
      ],
    };
  },
  component: WaterRecord,
});

function WaterRecord() {
  const d = Route.useLoaderData();
  const layers = buildLayers(d);
  const r = readiness(d);
  const [job, setJob] = useState<JobId | null>(null);
  const [copied, setCopied] = useState(false);
  const overdue = reviewOverdue(d);

  const copyHandoff = async () => {
    try {
      await navigator.clipboard.writeText(buildHandoff(d, job, null));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      {/* masthead */}
      <section className="relative isolate overflow-hidden">
        <img
          src={imageFor(d)}
          alt={`Representative water conditions for a ${d.waterType} corridor`}
          width={1280}
          height={960}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-abyss/85 via-abyss/70 to-background" />
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-16 sm:px-8 md:pb-20 md:pt-24">
          <Link to="/explore" className="tick text-primary hover:text-brass">
            ← Catalog
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="data text-xs text-brass">{d.id}</span>
            <span className="tick text-[0.55rem]">{d.waterType}</span>
            <GradeChip grade={r.grade} label={r.band} />
            {overdue && <GradeChip grade="restricted" label="Review overdue" />}
          </div>

          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.2rem,6vw,4.8rem)] font-bold leading-[0.9] tracking-[-0.045em] text-foreground">
            {d.waterbody}
          </h1>
          {d.accessSite && (
            <p className="mt-3 max-w-2xl font-display text-lg font-semibold tracking-tight text-brass">
              {d.accessSite}
            </p>
          )}
          <p className="mt-4 text-base text-muted-foreground">
            {d.region} · {d.state}
            {d.county ? ` · ${d.county} County` : ""}
          </p>

          <div className="mt-10 flex flex-wrap gap-3" data-print="hide">
            <Link
              to="/packet/$id"
              params={{ id: d.id }}
              search={job ? { job } : {}}
              className="inline-flex items-center gap-3 bg-brass px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Build field packet
            </Link>
            <a
              href={d.officialSourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 border border-hairline bg-abyss/60 px-6 py-3.5 text-xs uppercase tracking-[0.14em] text-foreground backdrop-blur hover:border-brass/50"
            >
              Official source
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* readout row */}
      <section className="border-y border-hairline bg-abyss">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-hairline md:grid-cols-4">
          {([
            { k: "Status", v: humanize(d.status) },
            { k: "Last source check", v: `${daysSince(d.checkedAt)}d ago` },
            { k: "Next review", v: d.nextReviewAt },
            { k: "Boundary", v: "Public destination" },
          ] as Array<{ k: string; v: string }>).map((s) => (
            <div key={s.k} className="px-5 py-6 sm:px-8">
              <dt className="tick text-[0.55rem]">{s.k}</dt>
              <dd className="mt-2 text-sm leading-snug text-foreground">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.55fr_1fr]">
        {/* layers */}
        <div>
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-brass" />
            <p className="tick text-brass">Intelligence stack</p>
          </div>
          <h2 className="mt-5 font-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold tracking-[-0.035em] text-foreground">
            Five layers on this water
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Open a layer to see the documented signals behind it and the
            unknowns it cannot close.
          </p>

          <div className="mt-8 border-y border-hairline">
            {layers.map((l, i) => (
              <LayerPanel key={l.key} layer={l} defaultOpen={i === 0} />
            ))}
          </div>

          {/* species context */}
          <div className="mt-14">
            <p className="tick text-brass">Species context</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {d.speciesContext.map((s: string) => (
                <span
                  key={s}
                  className="border border-hairline px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Presence context only. This is never an expectation of catch, and
              carries no statement about timing, forage or activity.
            </p>
          </div>
        </div>

        {/* rail */}
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <ReadinessMeter readiness={r} />

          <div className="panel p-6">
            <p className="tick text-alert">What this score cannot know</p>
            <ul className="mt-4 space-y-2.5">
              {r.cannotKnow.map((x) => (
                <li
                  key={x}
                  className="flex gap-3 text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 h-px w-4 shrink-0 bg-alert" />
                  {x}
                </li>
              ))}
            </ul>
          </div>

          {/* handoff */}
          <div className="panel p-6">
            <p className="tick text-brass">Carry this water forward</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Hand the record to Horizon Desk or Trip Prep with its open items,
              boundary note and source date attached.
            </p>

            <label className="tick mt-5 block text-[0.55rem]" htmlFor="job">
              Attach a declared job
            </label>
            <select
              id="job"
              value={job ?? ""}
              onChange={(e) => setJob((e.target.value || null) as JobId | null)}
              className="mt-2 w-full border border-hairline bg-card px-3 py-2.5 text-sm text-foreground outline-none"
            >
              <option value="">Not declared</option>
              {JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={copyHandoff}
                className="inline-flex items-center justify-center gap-2 border border-brass/50 bg-brass/10 px-5 py-3 text-xs uppercase tracking-[0.14em] text-brass transition-colors hover:bg-brass/20"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" /> Copied handoff
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" /> Copy handoff block
                  </>
                )}
              </button>
              <Link
                to="/packet/$id"
                params={{ id: d.id }}
                search={job ? { job } : {}}
                className="inline-flex items-center justify-center gap-2 border border-hairline px-5 py-3 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
              >
                <Printer className="h-4 w-4" aria-hidden="true" /> Field packet
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </div>
  );
}