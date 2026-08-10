import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { WaterCard } from "@/components/water-card";
import { CardSkeleton, EmptyState } from "@/components/instrument";
import {
  destinations,
  displayName,
  states,
  waterTypes,
  type Destination,
} from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";
import flatsImg from "@/assets/flats.jpg";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Catalog · Honey Hole Intelligence" },
      {
        name: "description",
        content:
          "Browse 277 named public waters across 16 states with layered access, hazard, capacity and regulatory intelligence. No private spots, no coordinates.",
      },
      { property: "og:title", content: "Catalog · Honey Hole Intelligence" },
      {
        property: "og:description",
        content:
          "Filter named public waters by state, water type and field readiness band.",
      },
    ],
  }),
  component: Explore,
});

const BANDS = ["Ready to plan", "Plan with checks", "Plan carefully", "Constrained"] as const;

const PAGE = 24;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-brass/60 bg-brass/15 text-brass"
          : "border-hairline text-muted-foreground hover:border-brass/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Explore() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [count, setCount] = useState(PAGE);
  const [settling, setSettling] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSettling(false), 420);
    return () => clearTimeout(t);
  }, []);

  const scored = useMemo(
    () => destinations.map((d) => ({ d, r: readiness(d) })),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored
      .filter(({ d, r }) => {
        if (state && d.state !== state) return false;
        if (type && d.waterType !== type) return false;
        if (band && r.band !== band) return false;
        if (!q) return true;
        return (
          displayName(d).toLowerCase().includes(q) ||
          d.region.toLowerCase().includes(q) ||
          d.state.toLowerCase().includes(q) ||
          d.speciesContext.join(" ").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.r.score - a.r.score);
  }, [scored, query, state, type, band]);

  useEffect(() => setCount(PAGE), [query, state, type, band]);

  const active = Boolean(query || state || type || band);
  const visible: Destination[] = results.slice(0, count).map((x) => x.d);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <section className="relative isolate overflow-hidden border-b border-hairline">
        <img
          src={flatsImg}
          alt="Open public water under low weather, seen from a shoreline access"
          width={1280}
          height={720}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-abyss via-abyss/85 to-abyss/40" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-brass" />
            <p className="tick text-brass">Catalog</p>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.2rem,5.4vw,4.2rem)] font-bold leading-[0.92] tracking-[-0.04em] text-foreground">
            {destinations.length} named public waters,
            <br />
            read one at a time.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Sorted by field readiness rather than alphabet, so the records that
            can actually carry a decision surface first. Looking for a specific
            job instead?{" "}
            <Link to="/plan" className="text-primary hover:text-brass">
              Plan a day
            </Link>
            .
          </p>
        </div>
      </section>

      {/* filter rail */}
      <div
        data-print="hide"
        className="sticky top-16 z-30 border-b border-hairline bg-background/90 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl space-y-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3 border border-hairline bg-card px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search water, region, state or species context"
              aria-label="Search the catalog"
              className="w-full bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="tick mr-1 text-[0.55rem]">Type</span>
            {waterTypes.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>
                {t}
              </Chip>
            ))}
            <span className="mx-2 h-4 w-px bg-hairline" />
            <span className="tick mr-1 text-[0.55rem]">Readiness</span>
            {BANDS.map((b) => (
              <Chip key={b} active={band === b} onClick={() => setBand(band === b ? null : b)}>
                {b}
              </Chip>
            ))}
            <span className="mx-2 h-4 w-px bg-hairline" />
            <select
              value={state ?? ""}
              onChange={(e) => setState(e.target.value || null)}
              aria-label="Filter by state"
              className="border border-hairline bg-card px-3 py-1.5 text-xs text-foreground outline-none"
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {active && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setState(null);
                  setType(null);
                  setBand(null);
                }}
                className="tick text-[0.55rem] text-primary hover:text-brass"
              >
                Reset
              </button>
            )}
            <span className="data ml-auto text-xs text-muted-foreground">
              {results.length} record{results.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {settling ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No record matches that read"
            body="The catalog holds only named public waters with published access. Widen the filters, or clear them and let readiness sort the field for you."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setState(null);
                  setType(null);
                  setBand(null);
                }}
                className="border border-brass/50 bg-brass/10 px-6 py-3 text-xs uppercase tracking-[0.14em] text-brass hover:bg-brass/20"
              >
                Clear all filters
              </button>
            }
          />
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((d) => (
                <WaterCard key={d.id} destination={d} />
              ))}
            </div>
            {count < results.length && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCount((c) => c + PAGE)}
                  className="border border-hairline px-8 py-4 text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                >
                  Show {Math.min(PAGE, results.length - count)} more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}