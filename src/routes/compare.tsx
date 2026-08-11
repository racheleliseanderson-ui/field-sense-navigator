import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { SiteHeader, SiteFooter } from "@/components/chrome";
import { EmptyState, GradeChip } from "@/components/instrument";
import {
  daysSince,
  destinations,
  displayName,
  humanize,
  reviewOverdue,
  type Destination,
} from "@/lib/catalog";
import { buildLayers, readTags, readiness } from "@/lib/intelligence";
import { COMPARE_LIMIT, useCompareTray } from "@/lib/compare-tray";
import { search } from "@/lib/search";
import { useReveal } from "@/lib/motion";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare waters · Field Sense Navigator" },
      {
        name: "description",
        content:
          "Hold up to four named public waters side by side: readiness, access anatomy, hazard and capacity layers, verification age and the unknowns each record still carries.",
      },
      { property: "og:title", content: "Compare waters · Field Sense Navigator" },
      {
        property: "og:description",
        content:
          "Aligned, row-by-row comparison of named public waters — with every unknown left visible.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compare,
});

interface Column {
  d: Destination;
  r: ReturnType<typeof readiness>;
  layers: ReturnType<typeof buildLayers>;
  tags: ReturnType<typeof readTags>;
}

function Picker({
  onPick,
  disabled,
  taken,
}: {
  onPick: (id: string) => void;
  disabled: boolean;
  taken: string[];
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(
    () =>
      search(q)
        .hits.map((h) => h.destination)
        .filter((d) => !taken.includes(d.id))
        .slice(0, 8),
    [q, taken],
  );

  return (
    <div className="panel p-4">
      <label className="tick text-[0.55rem]" htmlFor="compare-add">
        Add a water
      </label>
      <input
        id="compare-add"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "Four columns is the limit" : "Water, county, state or species"}
        className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brass/60 focus:outline-none disabled:opacity-50"
      />
      {!disabled && q.trim().length > 0 && (
        <ul className="mt-2 max-h-64 divide-y divide-hairline overflow-y-auto border border-hairline">
          {hits.length === 0 && (
            <li className="px-3 py-3 text-xs text-muted-foreground">
              No record carries that name. Nothing is invented to fill the column.
            </li>
          )}
          {hits.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(d.id);
                  setQ("");
                }}
                className="tap flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-panel"
              >
                <Plus className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{displayName(d)}</span>
                  <span className="block truncate text-[0.68rem] text-muted-foreground">
                    {d.region} · {d.state}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rule-top grid gap-3 py-5 md:grid-cols-[13rem_minmax(0,1fr)]" data-reveal>
      <div className="min-w-0">
        <p className="tick text-[0.55rem]">{label}</p>
        {note && (
          <p className="mt-1 text-[0.66rem] leading-relaxed text-muted-foreground">{note}</p>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto">
        <div className="grid min-w-[36rem] auto-cols-fr grid-flow-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Compare() {
  const { ids, records, remove, toggle, clear, full } = useCompareTray();
  const reveal = useReveal();
  const [busy, setBusy] = useState(false);

  const cols: Column[] = useMemo(
    () =>
      records.map((d) => ({
        d,
        r: readiness(d),
        layers: buildLayers(d),
        tags: readTags(d),
      })),
    [records],
  );

  const shared = useMemo(() => {
    if (cols.length < 2) return [];
    const first = cols[0]!.d.speciesContext;
    return first.filter((s) => cols.every((c) => c.d.speciesContext.includes(s)));
  }, [cols]);

  const exportPdf = async () => {
    setBusy(true);
    try {
      const { downloadShortlistPdf } = await import("@/lib/packet-pdf");
      downloadShortlistPdf(records, null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={reveal as React.RefObject<HTMLDivElement>} className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      <section className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">COMPARISON</span>
            <span className="h-px flex-1 bg-hairline" />
            <span className="data text-xs text-muted-foreground">
              {ids.length}/{COMPARE_LIMIT}
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2rem,5vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.04em] text-foreground">
            Four waters,
            <br />
            one aligned readout.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Rows line up so the difference between two records is visible instead of
            remembered. Where a record is silent, the row says so rather than filling
            the gap.
          </p>

          <div className="mt-8 grid gap-3 md:max-w-xl">
            <Picker onPick={toggle} disabled={full} taken={ids} />
            {ids.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cols.map((c) => (
                  <span
                    key={c.d.id}
                    className="inline-flex min-h-11 items-center gap-2 border border-brass/50 bg-brass/10 px-3 text-xs text-brass"
                  >
                    <span className="max-w-[12rem] truncate">{displayName(c.d)}</span>
                    <button
                      type="button"
                      onClick={() => remove(c.d.id)}
                      aria-label={`Remove ${displayName(c.d)} from the comparison`}
                      className="tap grid h-8 w-8 place-items-center"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clear}
                  className="tap inline-flex min-h-11 items-center border border-hairline px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={busy}
                  className="tap inline-flex min-h-11 items-center border border-hairline px-4 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50 hover:text-brass disabled:opacity-60"
                >
                  {busy ? "Building…" : "Shortlist PDF"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {cols.length === 0 ? (
          <EmptyState
            title="Nothing held for comparison yet"
            body="Add waters from the catalog, the watchlist or the search box above. Two is enough to be useful; four is the readable limit."
            action={
              <Link to="/explore" className="tick text-primary hover:text-brass">
                Open the catalog →
              </Link>
            }
          />
        ) : (
          <div>
            <Row label="Water">
              {cols.map((c) => (
                <div key={c.d.id} className="min-w-0">
                  <Link
                    to="/water/$id"
                    params={{ id: c.d.id }}
                    className="font-display text-base font-bold leading-tight text-foreground hover:text-brass"
                  >
                    {displayName(c.d)}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.d.region} · {c.d.state}
                  </p>
                  <p className="data mt-1 text-[0.62rem] text-muted-foreground">{c.d.id}</p>
                </div>
              ))}
            </Row>

            <Row label="Field readiness" note="Documentation quality, not a forecast.">
              {cols.map((c) => (
                <div key={c.d.id} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="data text-2xl font-semibold text-foreground">
                      {c.r.score}
                    </span>
                    <GradeChip grade={c.r.grade} label={c.r.band} />
                  </div>
                  <div className="mt-2 h-[2px] w-full bg-border/60">
                    <div className="h-full bg-primary" style={{ width: `${c.r.score}%` }} />
                  </div>
                </div>
              ))}
            </Row>

            <Row label="Water type">
              {cols.map((c) => (
                <p key={c.d.id} className="text-sm text-foreground/90">
                  {humanize(c.d.waterType)}
                </p>
              ))}
            </Row>

            {(["access", "conditions", "capacity", "seasonal", "fieldcheck"] as const).map(
              (key) => (
                <Row
                  key={key}
                  label={cols[0]!.layers.find((l) => l.key === key)?.title ?? key}
                  note="Grade, confidence, and what the layer still cannot see."
                >
                  {cols.map((c) => {
                    const l = c.layers.find((x) => x.key === key);
                    if (!l)
                      return (
                        <p key={c.d.id} className="text-xs text-muted-foreground">
                          Layer not built for this record.
                        </p>
                      );
                    return (
                      <div key={c.d.id} className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <GradeChip grade={l.grade} label={l.confidenceLabel} />
                          <span className="data text-xs text-muted-foreground">
                            {l.confidence}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-foreground/85">
                          {l.readout}
                        </p>
                        {l.unknowns[0] && (
                          <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                            Unknown: {l.unknowns[0]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </Row>
              ),
            )}

            <Row label="Published access" note="Named public facilities on the official source.">
              {cols.map((c) => (
                <div key={c.d.id} className="min-w-0">
                  <p className="data text-lg text-foreground">{c.d.publicAccess.length}</p>
                  <ul className="mt-1 space-y-1">
                    {c.d.publicAccess.slice(0, 4).map((a, i) => (
                      <li key={i} className="truncate text-[0.7rem] text-muted-foreground">
                        {a.name} · {humanize(a.type)}
                      </li>
                    ))}
                    {c.d.publicAccess.length === 0 && (
                      <li className="text-[0.7rem] text-muted-foreground">
                        No named site published.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </Row>

            <Row label="Species context" note="Agency wording, not a catch claim.">
              {cols.map((c) => (
                <p key={c.d.id} className="text-xs leading-relaxed text-foreground/85">
                  {c.d.speciesContext.slice(0, 6).join(", ") || "Not published on the record."}
                </p>
              ))}
            </Row>

            <Row label="Current notices">
              {cols.map((c) => (
                <div key={c.d.id} className="min-w-0">
                  <p className="data text-lg text-foreground">{c.d.currentNotices.length}</p>
                  <p className="mt-1 line-clamp-3 text-[0.7rem] leading-relaxed text-muted-foreground">
                    {c.d.currentNotices[0] ?? "No notice carried on the record."}
                  </p>
                </div>
              ))}
            </Row>

            <Row label="Verification" note="Age of the last check against the official page.">
              {cols.map((c) => (
                <div key={c.d.id} className="min-w-0">
                  <p className="data text-sm text-foreground">
                    {daysSince(c.d.checkedAt)} days ago
                  </p>
                  <p
                    className={`mt-1 text-[0.68rem] ${
                      reviewOverdue(c.d) ? "text-alert" : "text-muted-foreground"
                    }`}
                  >
                    {reviewOverdue(c.d)
                      ? "Review overdue — re-verify before travel."
                      : `Next review ${c.d.nextReviewAt}`}
                  </p>
                </div>
              ))}
            </Row>

            <Row label="Official source">
              {cols.map((c) => (
                <a
                  key={c.d.id}
                  href={c.d.officialSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tap inline-flex min-h-11 items-center break-all text-[0.7rem] text-primary hover:text-brass"
                >
                  {c.d.officialSourceUrl}
                </a>
              ))}
            </Row>

            <Row label="Record" note="Open the full instrument readout.">
              {cols.map((c) => (
                <Link
                  key={c.d.id}
                  to="/water/$id"
                  params={{ id: c.d.id }}
                  className="tap inline-flex min-h-11 items-center border border-hairline px-4 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50 hover:text-brass"
                >
                  Open record
                </Link>
              ))}
            </Row>

            {cols.length > 1 && (
              <div className="rule-top mt-6 pt-6">
                <p className="tick text-[0.55rem]">Shared species context</p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">
                  {shared.length > 0
                    ? shared.join(", ")
                    : "No species is published across every column. That is a difference in the records, not necessarily in the water."}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}