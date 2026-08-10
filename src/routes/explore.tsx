import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { WaterCard } from "@/components/water-card";
import { CardSkeleton, EmptyState } from "@/components/instrument";
import {
  destinations,
  states,
  waterTypes,
  daysSince,
  displayName,
  type Destination,
} from "@/lib/catalog";
import { readiness } from "@/lib/intelligence";
import {
  search,
  suggest,
  speciesList,
  ACCESS_FACETS,
  matchesAccess,
  matchesSpecies,
  type Suggestion,
} from "@/lib/search";
import { useReveal, useParallax } from "@/lib/motion";
import { useT } from "@/lib/i18n";
import { useWatchlist } from "@/lib/watchlist";
import flatsImg from "@/assets/flats.jpg";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  state: fallback(z.string(), "").default(""),
  type: fallback(z.string(), "").default(""),
  band: fallback(z.string(), "").default(""),
  species: fallback(z.string(), "").default(""),
  access: fallback(z.string(), "").default(""),
  fresh: fallback(z.number(), 0).default(0),
  min: fallback(z.number(), 0).default(0),
  watch: fallback(z.boolean(), false).default(false),
  sort: fallback(z.string(), "readiness").default("readiness"),
});

type CatalogSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Catalog · Honey Hole Intelligence" },
      {
        name: "description",
        content:
          "Search 277 named public waters by water, county, state, species or access type, with layered access, hazard, capacity and regulatory intelligence.",
      },
      { property: "og:title", content: "Catalog · Honey Hole Intelligence" },
      {
        property: "og:description",
        content:
          "Search named public waters by name, county, species or access, then sort by field readiness.",
      },
    ],
  }),
  component: Explore,
});

const BANDS = ["Ready to plan", "Plan with checks", "Plan carefully", "Constrained"] as const;
const SORTS = [
  { id: "readiness", key: "catalog.sort.readiness", label: "Readiness" },
  { id: "verified", key: "catalog.sort.verified", label: "Recently verified" },
  { id: "alpha", key: "catalog.sort.alpha", label: "Alphabetical" },
  { id: "state", key: "catalog.sort.state", label: "State" },
] as const;

const PAGE = 24;
const RECENT_KEY = "hhi-recent-searches";

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
      aria-pressed={active}
      className={`tap inline-flex min-h-11 items-center border px-3.5 text-xs ${
        active
          ? "border-brass/60 bg-brass/15 text-brass"
          : "border-hairline text-muted-foreground hover:border-brass/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function Explore() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/explore" });
  const t = useT();
  const reveal = useReveal();
  const heroImg = useParallax(0.22);
  const { ids: watched } = useWatchlist();

  const [draft, setDraft] = useState(params.q);
  const [focused, setFocused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [count, setCount] = useState(PAGE);
  const [settling, setSettling] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setSettling(false), 420);
    setRecent(readRecent());
    return () => clearTimeout(id);
  }, []);

  useEffect(() => setDraft(params.q), [params.q]);

  const set = (patch: Partial<CatalogSearch>) =>
    navigate({
      search: (prev: CatalogSearch) => ({ ...prev, ...patch }),
      replace: true,
    });

  const commit = (q: string) => {
    set({ q });
    setFocused(false);
    if (q.trim().length > 1) {
      const next = [q.trim(), ...readRecent().filter((r) => r !== q.trim())].slice(0, 6);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — the session still searches */
      }
    }
  };

  // Debounce free typing into the URL so a shared link always reflects the view.
  useEffect(() => {
    if (draft === params.q) return;
    const id = setTimeout(() => set({ q: draft }), 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const scores = useMemo(() => {
    const m = new Map<string, ReturnType<typeof readiness>>();
    for (const d of destinations) m.set(d.id, readiness(d));
    return m;
  }, []);

  const found = useMemo(() => search(params.q), [params.q]);

  const results = useMemo(() => {
    const rows = found.hits
      .map((h) => ({ d: h.destination, score: h.score, r: scores.get(h.destination.id)! }))
      .filter(({ d, r }) => {
        if (params.state && d.state !== params.state) return false;
        if (params.type && d.waterType !== params.type) return false;
        if (params.band && r.band !== params.band) return false;
        if (params.species && !matchesSpecies(d, params.species)) return false;
        if (params.access && !matchesAccess(d, params.access)) return false;
        if (params.fresh > 0 && daysSince(d.checkedAt) > params.fresh) return false;
        if (params.min > 0 && r.score < params.min) return false;
        if (params.watch && !watched.includes(d.id)) return false;
        return true;
      });

    const bySort: Record<string, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      readiness: (a, b) => b.score - a.score || b.r.score - a.r.score,
      verified: (a, b) => daysSince(a.d.checkedAt) - daysSince(b.d.checkedAt),
      alpha: (a, b) => displayName(a.d).localeCompare(displayName(b.d)),
      state: (a, b) =>
        a.d.state.localeCompare(b.d.state) || displayName(a.d).localeCompare(displayName(b.d)),
    };
    return rows.sort(bySort[params.sort] ?? bySort['readiness']!);
  }, [
    found,
    scores,
    watched,
    params.state,
    params.type,
    params.band,
    params.species,
    params.access,
    params.fresh,
    params.min,
    params.watch,
    params.sort,
  ]);

  useEffect(
    () => setCount(PAGE),
    [
      params.q,
      params.state,
      params.type,
      params.band,
      params.species,
      params.access,
      params.fresh,
      params.min,
      params.watch,
      params.sort,
    ],
  );

  const suggestions: Suggestion[] = useMemo(
    () => (focused ? suggest(draft) : []),
    [focused, draft],
  );

  const activeFilters =
    Number(Boolean(params.state)) +
    Number(Boolean(params.type)) +
    Number(Boolean(params.band)) +
    Number(Boolean(params.species)) +
    Number(Boolean(params.access)) +
    Number(params.fresh > 0) +
    Number(params.min > 0) +
    Number(params.watch);
  const anything = Boolean(params.q) || activeFilters > 0;
  const visible: Destination[] = results.slice(0, count).map((x) => x.d);

  const clearAll = () =>
    navigate({
      search: {
        q: "", state: "", type: "", band: "", species: "", access: "",
        fresh: 0, min: 0, watch: false, sort: "readiness",
      },
    });

  const filterControls = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tick mr-1 text-[0.55rem]">{t("catalog.type", "Water type")}</span>
        {waterTypes.map((w) => (
          <Chip
            key={w}
            active={params.type === w}
            onClick={() => set({ type: params.type === w ? "" : w })}
          >
            {w}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tick mr-1 text-[0.55rem]">{t("catalog.band", "Readiness band")}</span>
        {BANDS.map((b) => (
          <Chip
            key={b}
            active={params.band === b}
            onClick={() => set({ band: params.band === b ? "" : b })}
          >
            {b}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tick mr-1 text-[0.55rem]">{t("catalog.state", "State")}</span>
        <select
          value={params.state}
          onChange={(e) => set({ state: e.target.value })}
          aria-label={t("catalog.state", "State")}
          className="tap min-h-11 border border-hairline bg-card px-3 text-xs text-foreground outline-none"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="tick ml-2 mr-1 text-[0.55rem]">{t("catalog.sort", "Sort")}</span>
        <select
          value={params.sort}
          onChange={(e) => set({ sort: e.target.value })}
          aria-label={t("catalog.sort", "Sort")}
          className="tap min-h-11 border border-hairline bg-card px-3 text-xs text-foreground outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {t(s.key, s.label)}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div ref={reveal as React.Ref<HTMLDivElement>} className="page-in min-h-dvh bg-background">
      <SiteHeader />

      <section className="relative isolate overflow-hidden border-b border-hairline">
        <img
          ref={heroImg as React.Ref<HTMLImageElement>}
          src={flatsImg}
          alt="Open public water under low weather, seen from a shoreline access"
          width={1280}
          height={720}
          className="parallax image-treated absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-abyss via-abyss/85 to-abyss/40" />
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 md:py-24">
          <div className="flex items-center gap-4" data-reveal>
            <span className="h-px w-10 bg-brass" data-reveal-rule />
            <p className="tick text-brass">{t("catalog.title", "Catalog")}</p>
          </div>
          <h1
            className="mt-6 max-w-3xl font-display text-[clamp(2rem,5.4vw,4.2rem)] font-bold leading-[0.92] tracking-[-0.04em] text-foreground"
            data-reveal
            style={{ "--reveal-delay": "90ms" } as React.CSSProperties}
          >
            {destinations.length} named public waters,
            <br />
            read one at a time.
          </h1>
          <p
            className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground"
            data-reveal
            style={{ "--reveal-delay": "180ms" } as React.CSSProperties}
          >
            Search by water, county, state, species or access type — "kayak Texas"
            and "trout river" resolve themselves. Looking for a specific job?{" "}
            <Link to="/plan" className="text-primary hover:text-brass">
              Plan a day
            </Link>
            .
          </p>
        </div>
      </section>

      {/* search + filters */}
      <div
        data-print="hide"
        className="sticky top-16 z-30 border-b border-hairline bg-background/95 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl space-y-4 px-5 py-4 sm:px-8 sm:py-5">
          <div className="relative">
            <div className="flex items-center gap-3 border border-hairline bg-card px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 140)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(draft);
                  if (e.key === "Escape") setFocused(false);
                }}
                enterKeyHint="search"
                placeholder={t(
                  "catalog.search",
                  "Search waters, counties, states, species, access",
                )}
                aria-label={t("catalog.search", "Search the catalog")}
                className="min-h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              {draft && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    set({ q: "" });
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="tap grid h-11 w-11 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="tap -mr-2 flex min-h-12 shrink-0 items-center gap-2 border-l border-hairline pl-3 pr-1 text-xs uppercase tracking-[0.12em] text-muted-foreground lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {t("catalog.filters", "Filters")}
                {activeFilters > 0 && (
                  <span className="data bg-brass/20 px-1.5 text-brass">{activeFilters}</span>
                )}
              </button>
            </div>

            {focused && (suggestions.length > 0 || (draft.length < 2 && recent.length > 0)) && (
              <div className="panel absolute inset-x-0 top-full z-40 mt-1 max-h-[60vh] overflow-y-auto p-2">
                {draft.length < 2 && recent.length > 0 && (
                  <>
                    <p className="tick px-3 py-2 text-[0.55rem]">
                      {t("catalog.recent", "Recent searches")}
                    </p>
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDraft(r);
                          commit(r);
                        }}
                        className="tap flex min-h-11 w-full items-center px-3 text-left text-sm text-foreground hover:bg-panel"
                      >
                        {r}
                      </button>
                    ))}
                  </>
                )}
                {suggestions.map((s) => (
                  <button
                    key={`${s.kind}-${s.label}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (s.kind === "state") {
                        setDraft("");
                        set({ q: "", state: s.label });
                      } else {
                        setDraft(s.label);
                        commit(s.label);
                      }
                    }}
                    className="tap flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-panel"
                  >
                    <span className="tick w-16 shrink-0 text-[0.5rem]">{s.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{s.label}</span>
                      {s.sub && (
                        <span className="block truncate text-[0.68rem] text-muted-foreground">
                          {s.sub}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* resolved facets from plain text */}
          {(found.tokens.length > 0 || activeFilters > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {found.tokens.map((tok) => (
                <span
                  key={`${tok.kind}-${tok.value}`}
                  className="inline-flex items-center gap-2 border border-brass/40 bg-brass/10 px-2.5 py-1 text-[0.68rem] text-brass"
                >
                  <span className="tick text-[0.5rem] text-brass/70">{tok.kind}</span>
                  {tok.value}
                </span>
              ))}
              {(
                [
                  ["state", params.state],
                  ["type", params.type],
                  ["band", params.band],
                ] as const
              )
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set({ [k]: "" } as Partial<CatalogSearch>)}
                    className="tap inline-flex min-h-9 items-center gap-2 border border-hairline px-2.5 text-[0.68rem] text-foreground"
                  >
                    {v}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              {anything && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="tick tap inline-flex min-h-9 items-center text-[0.55rem] text-primary hover:text-brass"
                >
                  {t("catalog.clearAll", "Clear all")}
                </button>
              )}
            </div>
          )}

          <div className="hidden flex-wrap items-center gap-x-4 gap-y-3 lg:flex">
            {filterControls}
            <span className="data ml-auto text-xs text-muted-foreground" aria-live="polite">
              {results.length}{" "}
              {results.length === 1
                ? t("catalog.result", "result")
                : t("catalog.results", "results")}
            </span>
          </div>

          <p className="data text-xs text-muted-foreground lg:hidden" aria-live="polite">
            {results.length}{" "}
            {results.length === 1
              ? t("catalog.result", "result")
              : t("catalog.results", "results")}
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        {settling ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title={t("catalog.noMatch", "No record matches that read")}
            body={
              found.suggestion
                ? `Nothing matched. The closest water name on record is "${found.suggestion}".`
                : t(
                    "catalog.noMatchBody",
                    "The catalog holds only named public waters with published access. Widen the search, or clear it and let readiness sort the field for you.",
                  )
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {found.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(found.suggestion!);
                      commit(found.suggestion!);
                    }}
                    className="tap min-h-12 border border-brass/50 bg-brass/10 px-6 text-xs uppercase tracking-[0.14em] text-brass hover:bg-brass/20"
                  >
                    Search "{found.suggestion}"
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="tap min-h-12 border border-hairline px-6 text-xs uppercase tracking-[0.14em] text-foreground hover:border-brass/50"
                >
                  {t("catalog.clearAll", "Clear all filters")}
                </button>
              </div>
            }
          />
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((d, i) => (
                <div
                  key={d.id}
                  data-reveal
                  style={{ "--reveal-delay": `${Math.min(i, 8) * 55}ms` } as React.CSSProperties}
                >
                  <WaterCard destination={d} />
                </div>
              ))}
            </div>
            {count < results.length && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCount((c) => c + PAGE)}
                  className="tap min-h-14 border border-hairline px-8 text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                >
                  {t("catalog.loadMore", "Show")} {Math.min(PAGE, results.length - count)} more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* mobile filter sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheet(false)}
            className="absolute inset-0 bg-abyss/70 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto border-t border-hairline bg-background p-5 pb-8">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-lg font-bold text-foreground">
                {t("catalog.filters", "Filters")}
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="tick tap inline-flex min-h-11 items-center text-[0.55rem] text-primary"
              >
                {t("catalog.clearAll", "Clear all")}
              </button>
            </div>
            <div className="mt-5 space-y-5">{filterControls}</div>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="tap mt-7 min-h-14 w-full bg-brass text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground"
            >
              {t("catalog.apply", "Show")} {results.length}{" "}
              {results.length === 1
                ? t("catalog.result", "result")
                : t("catalog.results", "results")}
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}