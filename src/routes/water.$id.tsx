import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useParallax, useReveal } from "@/lib/motion";
import { ArrowUpRight, Check, Copy, Download, Printer } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { GradeChip, LayerPanel, ReadinessMeter } from "@/components/instrument";
import { WatchButton } from "@/components/watch-button";
import { LiveConditions } from "@/components/live-conditions";
import {
  destinationById,
  displayName,
  humanize,
  daysSince,
  reviewOverdue,
  relatedRecords,
  RELATION_LABEL,
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
        { title: `${name} · Field Sense Navigator` },
        {
          name: "description",
          content: `Layered public-waters intelligence for ${name} in ${place}: access and legality, hazards, capacity, regulatory pressure and same-day field checks.`,
        },
        { property: "og:title", content: `${name} · Field Sense Navigator` },
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [openLayer, setOpenLayer] = useState<string | null>(
    layers[0]?.key ?? null,
  );
  const overdue = reviewOverdue(d);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadPacketPdf } = await import("@/lib/packet-pdf");
      downloadPacketPdf(d, job);
    } finally {
      setPdfBusy(false);
    }
  };

  const reveal = useReveal();
  const heroRef = useParallax(0.2);

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
    <div ref={reveal as React.Ref<HTMLDivElement>} className="page-in min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      {/* masthead */}
      <section className="relative isolate overflow-hidden">
        <img
          ref={heroRef as React.Ref<HTMLImageElement>}
          src={imageFor(d)}
          alt={`Representative water conditions for a ${d.waterType} corridor`}
          width={1280}
          height={960}
          className="parallax image-treated absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-abyss/85 via-abyss/70 to-background" />
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 sm:px-8 sm:pt-16 md:pb-20 md:pt-24">
          <Link to="/explore" className="tick text-primary hover:text-brass">
            ← Catalog
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-3">
            <span className="data text-xs text-brass">{d.id}</span>
            <span className="tick text-[0.55rem]">{d.waterType}</span>
            <GradeChip grade={r.grade} label={r.band} />
            {overdue && <GradeChip grade="restricted" label="Review overdue" />}
            <WatchButton id={d.id} name={displayName(d)} />
          </div>

          <h1 className="mt-4 max-w-4xl break-words font-display text-[clamp(1.9rem,7vw,4.8rem)] font-bold leading-[0.95] tracking-[-0.04em] text-foreground sm:mt-5 sm:leading-[0.9]">
            {d.waterbody}
          </h1>
          {d.accessSite && (
            <p className="mt-3 max-w-2xl font-display text-base font-semibold tracking-tight text-brass sm:text-lg">
              {d.accessSite}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground sm:mt-4 sm:text-base">
            {d.region} · {d.state}
            {d.county ? ` · ${d.county} County` : ""}
          </p>

          {overdue && (
            <div
              role="status"
              className="mt-6 max-w-2xl border border-alert/50 bg-alert/10 px-5 py-4"
            >
              <p className="tick text-alert">Review overdue</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                This record was due for review on {d.nextReviewAt}. That date
                has passed. Every layer below is provisional. Re-read the
                official source before you treat any of it as current.
              </p>
            </div>
          )}

          {/* readiness band — above the fold on a phone */}
          <div className="panel mt-7 p-5 lg:hidden" data-print="hide">
            <ReadinessMeter readiness={r} compact />
          </div>

          <div
            className="mt-8 hidden flex-wrap gap-3 sm:flex md:mt-10"
            data-print="hide"
          >
            <Link
              to="/packet/$id"
              params={{ id: d.id }}
              search={job ? { job } : {}}
              className="inline-flex items-center gap-3 bg-brass px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Build field packet
            </Link>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 border border-brass/50 bg-brass/10 px-6 py-3.5 text-xs uppercase tracking-[0.14em] text-brass backdrop-blur transition-colors hover:bg-brass/20 disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfBusy ? "Preparing PDF…" : "Download PDF"}
            </button>
            <a
              href={d.officialSourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 border border-hairline bg-abyss/60 px-6 py-3.5 text-xs uppercase tracking-[0.14em] text-foreground backdrop-blur hover:border-brass/50"
            >
              Official source
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {d.officialRegsUrl && d.officialRegsUrl !== d.officialSourceUrl && (
              <a
                href={d.officialRegsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 border border-hairline bg-abyss/60 px-6 py-3.5 text-xs uppercase tracking-[0.14em] text-foreground backdrop-blur hover:border-brass/50"
              >
                Official regulations
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>

          <a
            href={d.officialSourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            data-print="hide"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-hairline bg-abyss/60 px-6 text-xs uppercase tracking-[0.14em] text-foreground backdrop-blur sm:hidden"
          >
            Official source
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* readout row */}
      <section className="border-y border-hairline bg-abyss">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-hairline md:grid-cols-4 md:divide-y-0">
          {([
            { k: "Status", v: humanize(d.status) },
            { k: "Last source check", v: `${daysSince(d.checkedAt)}d ago` },
            {
              k: overdue ? "Review overdue" : "Next review",
              v: overdue ? `Due ${d.nextReviewAt}` : d.nextReviewAt,
            },
            {
              k: "Managing agency",
              v: d.managingAgency ?? "Not recorded from the cited source",
            },
          ] as Array<{ k: string; v: string }>).map((s) => (
            <div key={s.k} className="min-w-0 px-5 py-5 sm:px-8 sm:py-6">
              <dt className={`tick text-[0.55rem] ${s.k === "Review overdue" ? "text-alert" : ""}`}>
                {s.k}
              </dt>
              <dd
                className={`mt-2 text-sm leading-snug ${
                  s.k === "Review overdue" ? "text-alert" : "text-foreground"
                }`}
              >
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 overflow-x-hidden px-5 pb-28 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.55fr_1fr] lg:pb-16">
        {/* layers */}
        <div className="min-w-0">
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
            {layers.map((l) => (
              <LayerPanel
                key={l.key}
                layer={l}
                open={openLayer === l.key}
                onToggle={() =>
                  setOpenLayer((cur) => (cur === l.key ? null : l.key))
                }
              />
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

          {relatedRecords(d).length > 0 && (
            <div className="mt-14">
              <p className="tick text-brass">Related public waters</p>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Explicit catalog links only. Records are not merged; each water keeps its own source and review date.
              </p>
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                {relatedRecords(d).map((rel) => (
                  <li key={`${rel.relation}-${rel.id}`}>
                    <Link
                      to="/water/$id"
                      params={{ id: rel.id }}
                      className="tap flex min-h-12 items-center justify-between gap-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground">
                          {displayName(rel.destination)}
                        </span>
                        <span className="tick mt-1 block text-[0.55rem] text-muted-foreground">
                          {RELATION_LABEL[rel.relation]} · {rel.destination.state}
                        </span>
                      </span>
                      <span className="data shrink-0 text-[0.62rem] text-muted-foreground">
                        {rel.id}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* rail */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-28 lg:self-start">
          <LiveConditions destination={d} />
          <div className="panel p-6 lg:p-6">
            <ReadinessMeter readiness={r} compact />
            <dl className="mt-6 space-y-4">
              {r.parts.map((p) => (
                <div key={p.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-foreground">{p.label}</dt>
                    <dd className="data text-sm text-muted-foreground">
                      {p.value}
                      <span className="opacity-50">/{p.max}</span>
                    </dd>
                  </div>
                  <div className="mt-1.5 h-[2px] w-full bg-border/50">
                    <div
                      className="h-full bg-brass"
                      style={{ width: `${(p.value / p.max) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {p.note}
                  </p>
                </div>
              ))}
            </dl>
          </div>

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
              className="mt-2 min-h-12 w-full border border-hairline bg-card px-3 text-sm text-foreground outline-none"
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
                aria-live="polite"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-brass/50 bg-brass/10 px-5 text-xs uppercase tracking-[0.14em] text-brass transition-colors hover:bg-brass/20"
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
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
              >
                <Printer className="h-4 w-4" aria-hidden="true" /> Field packet
              </Link>
              <WatchButton id={d.id} name={displayName(d)} variant="full" />
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfBusy}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {pdfBusy ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
        </aside>
      </section>

      {/* thumb bar — phones only */}
      <div
        data-print="hide"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-abyss/95 backdrop-blur-xl sm:hidden"
      >
        <div className="grid grid-cols-3 divide-x divide-hairline">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6rem] uppercase tracking-[0.12em] text-brass disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {pdfBusy ? "Preparing" : "PDF"}
          </button>
          <Link
            to="/packet/$id"
            params={{ id: d.id }}
            search={job ? { job } : {}}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6rem] uppercase tracking-[0.12em] text-foreground"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Packet
          </Link>
          <button
            type="button"
            onClick={copyHandoff}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6rem] uppercase tracking-[0.12em] text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-clear" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Carry"}
          </button>
        </div>
      </div>

      </main>
      <SiteFooter />
      <div className="h-14 sm:hidden" aria-hidden="true" />
    </div>
  );
}