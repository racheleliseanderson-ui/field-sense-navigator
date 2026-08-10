import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Printer, Trash2 } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { EmptyState } from "@/components/instrument";
import { WaterCard } from "@/components/water-card";
import { useWatchlist } from "@/lib/watchlist";
import { displayName } from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist · Honey Hole Intelligence" },
      {
        name: "description",
        content:
          "Waters you are tracking, held with their readiness band and source date, exportable as a single multi-water field packet.",
      },
      { property: "og:title", content: "Watchlist · Honey Hole Intelligence" },
      {
        property: "og:description",
        content:
          "A saved shortlist of public waters, ready to export as one briefing document.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { records, clear, toggle } = useWatchlist();
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const { downloadShortlistPdf } = await import("@/lib/packet-pdf");
      downloadShortlistPdf(records, null);
    } finally {
      setBusy(false);
    }
  };

  const bands = records.map((d) => readiness(d));
  const avg =
    bands.length > 0
      ? Math.round(bands.reduce((a, b) => a + b.score, 0) / bands.length)
      : 0;

  return (
    <div className="page-in min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      <section className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-brass" />
            <p className="tick text-brass">Watchlist</p>
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2rem,5vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.04em] text-foreground">
            Waters you are tracking
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Saved on this device only. Nothing is uploaded, and the boundary is
            unchanged — public waters with published access, nothing else.
          </p>

          {records.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="data text-sm text-foreground">
                {records.length} water{records.length === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-muted-foreground">
                mean readiness {avg}/100
              </span>
              <button
                type="button"
                onClick={exportAll}
                disabled={busy}
                className="tap inline-flex min-h-12 items-center gap-2 bg-brass px-6 text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy ? "Preparing PDF…" : "Export shortlist PDF"}
              </button>
              <Link
                to="/plan"
                className="tap inline-flex min-h-12 items-center gap-2 border border-hairline px-6 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Plan a day
              </Link>
              <button
                type="button"
                onClick={clear}
                className="tap inline-flex min-h-12 items-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:border-alert/60 hover:text-alert"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {records.length === 0 ? (
          <EmptyState
            title="Nothing on the watchlist yet"
            body="Mark a water from the catalog or its record and it is held here with its readiness band, ready to export as one briefing document."
            action={
              <Link
                to="/explore"
                className="tap inline-flex min-h-12 items-center border border-brass/50 bg-brass/10 px-6 text-xs uppercase tracking-[0.14em] text-brass hover:bg-brass/20"
              >
                Open the catalog
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {records.map((d) => (
              <div key={d.id} className="relative">
                <WaterCard destination={d} />
                <button
                  type="button"
                  onClick={() => toggle(d.id)}
                  className="tick mt-2 inline-flex min-h-9 items-center text-[0.55rem] text-muted-foreground hover:text-alert"
                >
                  Remove {displayName(d)}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
