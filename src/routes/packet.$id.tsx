import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { destinationById, displayName, humanize, reviewOverdue } from "@/lib/catalog";
import {
  CHECK_GROUPS,
  DEFAULT_CONSTRAINTS,
  JOBS,
  buildChecklist,
  buildLayers,
  readTags,
  readiness,
  type JobId,
} from "@/lib/intelligence";

type PacketSearch = { job?: JobId | undefined };

export const Route = createFileRoute("/packet/$id")({
  validateSearch: (search: Record<string, unknown>): PacketSearch => {
    const job = typeof search['job'] === "string" ? (search['job'] as JobId) : undefined;
    return JOBS.some((j) => j.id === job) ? { job } : {};
  },
  loader: ({ params }) => {
    const d = destinationById(params.id);
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    const name = loaderData ? displayName(loaderData) : "Field packet";
    return {
      meta: [
        { title: `Field Packet — ${name} · Field Sense Navigator` },
        {
          name: "description",
          content: `Printable same-day field packet for ${name}: declared job, open verifications, hazard and capacity notes, and standing rules. Public waters only.`,
        },
        { property: "og:title", content: `Field Packet — ${name}` },
        {
          property: "og:description",
          content: `A one-page briefing document to carry into the field for ${name}.`,
        },
      ],
    };
  },
  component: Packet,
});

function Rule() {
  return <div className="my-7 h-px w-full bg-packet-rule" />;
}

function Packet() {
  const d = Route.useLoaderData();
  const { job } = Route.useSearch();
  const [pdfBusy, setPdfBusy] = useState(false);
  const r = readiness(d);
  const layers = buildLayers(d);
  const t = readTags(d);
  const items = buildChecklist(d, job ?? null, job ? DEFAULT_CONSTRAINTS : null);
  const jobLabel = JOBS.find((j) => j.id === job)?.label ?? "Not declared";
  const issued = new Date().toISOString().slice(0, 10);
  const overdue = reviewOverdue(d);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadPacketPdf } = await import("@/lib/packet-pdf");
      downloadPacketPdf(d, job ?? null);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-abyss py-0 print:bg-white print:py-0 md:py-12">
      {/* toolbar */}
      <div
        data-print="hide"
        className="sticky top-0 z-40 mb-6 border-b border-hairline bg-abyss/95 backdrop-blur-xl print:hidden sm:static sm:mb-8 sm:border-0 sm:bg-transparent sm:backdrop-blur-none"
      >
        <div className="mx-auto flex max-w-[54rem] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:py-0">
          <Link
            to="/water/$id"
            params={{ id: d.id }}
            className="tick inline-flex min-h-11 items-center text-primary hover:text-brass"
          >
            ← Back to record
          </Link>
          <div className="flex flex-1 gap-2 sm:flex-none">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfBusy}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-3 bg-brass px-6 text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60 sm:flex-none"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfBusy ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden min-h-12 items-center justify-center gap-3 border border-hairline px-6 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50 sm:inline-flex"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* sheet */}
      <main><article className="packet mx-auto max-w-[54rem] bg-packet px-5 py-9 text-packet-ink shadow-[0_40px_120px_-40px_rgba(0,0,0,0.35)] sm:px-14 sm:py-16 print:max-w-none print:shadow-none">
        <header className="grid gap-4 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
          <div>
            <p className="packet-tick">Field Sense Navigator</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,9vw,2.6rem)] font-bold leading-[0.95] tracking-[-0.04em]">
              Field Packet
            </h1>
          </div>
          <div className="text-[0.7rem] leading-relaxed text-packet-muted sm:text-right">
            <p className="data">RECORD {d.id}</p>
            <p>Issued {issued}</p>
          </div>
        </header>

        <Rule />

        <section>
          <h2 className="font-display text-[clamp(1.6rem,7vw,1.875rem)] font-bold leading-tight tracking-[-0.035em]">
            {d.waterbody}
          </h2>
          {d.accessSite && (
            <p className="mt-1 text-base font-semibold text-packet-muted sm:text-lg">
              {d.accessSite}
            </p>
          )}
          <p className="mt-2 text-sm text-packet-muted">
            {d.region}, {d.state}
            {d.county ? ` · ${d.county} County` : ""} · {d.waterType}
          </p>

          {overdue && (
            <p className="mt-5 border border-packet-ink/40 px-3 py-2 text-sm font-medium leading-relaxed">
              Review overdue since {d.nextReviewAt}. Re-read the official source
              before you treat this packet as current.
            </p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {[
              ["Declared job", jobLabel],
              ["Field readiness", `${r.score}/100`],
              ["Band", r.band],
              [
                overdue ? "Review overdue" : "Last source check",
                overdue ? `Due ${d.nextReviewAt}` : d.checkedAt.slice(0, 10),
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="packet-tick">{k}</dt>
                <dd className="mt-1.5 text-sm font-medium leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Rule />

        {/* checklist */}
        <section>
          <h3 className="packet-tick">Same-day field check</h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-packet-muted">
            Tailored to this water{job ? ` and to a ${jobLabel.toLowerCase()} day` : ""}.
            Every line is an action you take, not a condition we claim to know.
          </p>

          <div className="mt-6 space-y-7">
            {CHECK_GROUPS.map((g) => {
              const group = items.filter((i) => i.group === g);
              if (group.length === 0) return null;
              return (
                <div key={g} className="break-inside-avoid">
                  <p className="font-display text-sm font-bold uppercase tracking-[0.1em]">
                    {g}
                  </p>
                  <ul className="mt-3 divide-y divide-packet-rule/70 sm:divide-y-0">
                    {group.map((i, n) => (
                      <li
                        key={`${g}-${n}`}
                        className="flex min-h-11 items-start gap-3 py-2.5 sm:min-h-0 sm:py-0 sm:pb-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0 border border-packet-ink/60 sm:h-3.5 sm:w-3.5"
                        />
                        <span className="min-w-0 text-sm leading-relaxed">
                          {i.text}
                          <span className="ml-2 whitespace-nowrap text-[0.68rem] uppercase tracking-[0.08em] text-packet-muted">
                            {i.source}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <Rule />

        {/* layer digest */}
        <section className="break-inside-avoid">
          <h3 className="packet-tick">Layer digest</h3>
          <div className="mt-5 divide-y divide-packet-rule border-y border-packet-rule">
            {layers.map((l) => (
              <div key={l.key} className="grid gap-1.5 py-4 sm:gap-2 sm:grid-cols-[10rem_1fr]">
                <p className="font-display text-sm font-bold tracking-tight">{l.title}</p>
                <div>
                  <p className="text-sm leading-relaxed">{l.readout}</p>
                  <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.08em] text-packet-muted">
                    Confidence {l.confidence}% · {l.unknowns.length} residual unknown
                    {l.unknowns.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        <section className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="packet-tick">Recorded hazard families</h3>
            <p className="mt-2 text-sm leading-relaxed">
              {t.hazards.size ? [...t.hazards].map(humanize).join(", ") : "None recorded."}
            </p>
            <h3 className="packet-tick mt-6">Capacity pressure</h3>
            <p className="mt-2 text-sm leading-relaxed">
              {t.crowd.size ? [...t.crowd].map(humanize).join(", ") : "None recorded."}
            </p>
          </div>
          <div>
            <h3 className="packet-tick">Official source</h3>
            <p className="mt-2 break-words text-sm leading-relaxed">{d.officialSourceUrl}</p>
            <h3 className="packet-tick mt-6">Species context</h3>
            <p className="mt-2 text-sm leading-relaxed">{d.speciesContext.join(", ")}</p>
          </div>
        </section>

        <Rule />

        <footer className="text-[0.72rem] leading-relaxed text-packet-muted">
          <p className="font-semibold uppercase tracking-[0.1em] text-packet-ink">
            Boundary and limitations
          </p>
          <p className="mt-2">
            Public, named destinations only. This packet contains no private
            spots, no coordinates, no catch expectation, and no live gauge,
            flow, tide, weather or hatch data. Conditions and regulations change
            without notice; the official source above governs. If a check cannot
            be cleared, the correct answer is not to go.
          </p>
        </footer>
      </article></main>
    </div>
  );
}