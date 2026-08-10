import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

import { SiteHeader, SiteFooter } from "@/components/chrome";
import { GradeChip } from "@/components/instrument";
import { destinations, displayName, states } from "@/lib/catalog";
import { coverage, integrity, type ProbeResult } from "@/lib/pipeline";
import { getLiveConditions } from "@/lib/live.functions";
import { useCompareTray } from "@/lib/compare-tray";
import { useWatchlist } from "@/lib/watchlist";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline console · Honey Hole Intelligence" },
      {
        name: "description",
        content:
          "Catalog integrity, state coverage and on-demand live-feed resolution for the named public waters held by the instrument.",
      },
      { property: "og:title", content: "Pipeline console · Honey Hole Intelligence" },
      {
        property: "og:description",
        content:
          "Run integrity checks and official station resolution against the catalog, and read the failures rather than hide them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pipeline,
});

type Scope = "watchlist" | "compare" | "state" | "sample";

function Pipeline() {
  const { ids: watched } = useWatchlist();
  const { ids: compared } = useCompareTray();
  const [scope, setScope] = useState<Scope>("sample");
  const [state, setState] = useState<string>(states[0] ?? "");
  const [limit, setLimit] = useState(12);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [done, setDone] = useState(0);
  const stop = useRef(false);

  const checks = useMemo(() => integrity(), []);
  const rows = useMemo(() => coverage(), []);

  const pool = useMemo(() => {
    const byId = (list: string[]) =>
      list.map((id) => destinations.find((d) => d.id === id)).filter((d) => Boolean(d));
    if (scope === "watchlist") return byId(watched).slice(0, limit);
    if (scope === "compare") return byId(compared).slice(0, limit);
    if (scope === "state") return destinations.filter((d) => d.state === state).slice(0, limit);
    return destinations.slice(0, limit);
  }, [scope, watched, compared, state, limit]);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setResults([]);
    setDone(0);
    for (const d of pool) {
      if (stop.current || !d) break;
      let row: ProbeResult;
      try {
        const live = await getLiveConditions({
          data: { state: d.state, waterbody: d.waterbody },
        });
        row = {
          id: d.id,
          name: displayName(d),
          state: d.state,
          status: live.station ? "matched" : "unmatched",
          station: live.station ? `${live.station.agency} ${live.station.id}` : null,
          readings: live.readings.length,
          note: live.station
            ? live.station.name
            : (live.unknowns[0] ?? "No official station publishes under this name."),
        };
      } catch {
        row = {
          id: d.id,
          name: displayName(d),
          state: d.state,
          status: "error",
          station: null,
          readings: 0,
          note: "The agency feed could not be reached on this run. Treat the water as unmonitored.",
        };
      }
      setResults((prev) => [...prev, row]);
      setDone((n) => n + 1);
    }
    setRunning(false);
  };

  const matched = results.filter((r) => r.status === "matched").length;
  const progress = pool.length === 0 ? 0 : Math.round((done / pool.length) * 100);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <section className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">PIPELINE</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2rem,5vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.04em] text-foreground">
            What the catalog
            <br />
            knows about itself.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Integrity is computed from the records, not asserted. Station resolution runs
            on demand against official feeds, and reports the misses as plainly as the hits.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { k: "Records", v: destinations.length },
              { k: "States", v: rows.length },
              { k: "Checks", v: checks.length },
              { k: "Flagged", v: checks.filter((c) => c.severity === "flagged").length },
            ].map((s) => (
              <div key={s.k}>
                <dt className="tick text-[0.55rem]">{s.k}</dt>
                <dd className="data mt-1 text-2xl text-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Catalog integrity
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {checks.map((c) => (
            <li key={c.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-display text-base font-bold text-foreground">
                  {c.label}
                </p>
                <GradeChip
                  grade={c.severity === "flagged" ? "flagged" : c.severity === "watch" ? "watch" : "clear"}
                  label={c.severity === "clear" ? "Pass" : c.severity === "watch" ? "Watch" : "Flagged"}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
              <p className="data mt-3 text-sm text-foreground">
                {c.total - c.count}/{c.total} records clear
              </p>
              {c.examples.length > 0 && (
                <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                  Failing: {c.examples.join(", ")}
                  {c.count > c.examples.length ? ` +${c.count - c.examples.length} more` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Live station resolution
        </h2>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Each run asks the official station index whether a gauge publishes under the
          water's own name. No nearby station is substituted for a miss.
        </p>

        <div className="panel mt-6 grid gap-4 p-5 md:grid-cols-[auto_auto_auto_1fr] md:items-end">
          <div>
            <label className="tick text-[0.55rem]" htmlFor="scope">
              Scope
            </label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground md:w-48"
            >
              <option value="sample">Catalog head</option>
              <option value="state">One state</option>
              <option value="watchlist">Watchlist</option>
              <option value="compare">Comparison tray</option>
            </select>
          </div>
          {scope === "state" && (
            <div>
              <label className="tick text-[0.55rem]" htmlFor="pipeline-state">
                State
              </label>
              <select
                id="pipeline-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground md:w-48"
              >
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="tick text-[0.55rem]" htmlFor="limit">
              Batch size
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground md:w-32"
            >
              {[6, 12, 24, 48].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={run}
              disabled={running || pool.length === 0}
              className="tap inline-flex min-h-11 items-center gap-2 border border-brass/50 bg-brass/10 px-5 text-xs uppercase tracking-[0.14em] text-brass disabled:opacity-50"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run ({pool.length})
            </button>
            <button
              type="button"
              onClick={() => {
                stop.current = true;
              }}
              disabled={!running}
              className="tap inline-flex min-h-11 items-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground disabled:opacity-50"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop
            </button>
          </div>
        </div>

        <div className="mt-4" aria-live="polite">
          <div className="h-[2px] w-full bg-border/60">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="data mt-2 text-xs text-muted-foreground">
            {running ? "Running" : done > 0 ? "Run complete" : "Idle"} · {done}/{pool.length} probed ·{" "}
            {matched} matched to an official station
          </p>
        </div>

        {results.length > 0 && (
          <ul className="mt-6 divide-y divide-hairline border border-hairline">
            {results.map((r) => (
              <li key={r.id} className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{r.name}</p>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
                    {r.state} · {r.note}
                  </p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <span className="data text-xs text-muted-foreground">
                    {r.station ?? "no station"} · {r.readings} readings
                  </span>
                  <GradeChip
                    grade={r.status === "matched" ? "clear" : r.status === "unmatched" ? "watch" : "flagged"}
                    label={r.status === "matched" ? "Matched" : r.status === "unmatched" ? "Unmatched" : "Error"}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          State coverage
        </h2>
        <div className="mt-6 overflow-x-auto border border-hairline">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="tick px-4 py-3 text-left text-[0.55rem]">State</th>
                <th scope="col" className="tick px-4 py-3 text-right text-[0.55rem]">Records</th>
                <th scope="col" className="tick px-4 py-3 text-right text-[0.55rem]">Median readiness</th>
                <th scope="col" className="tick px-4 py-3 text-right text-[0.55rem]">Review overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.state} className="border-b border-hairline/60">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-foreground">
                    {r.state}
                  </th>
                  <td className="data px-4 py-3 text-right text-foreground/90">{r.records}</td>
                  <td className="data px-4 py-3 text-right text-foreground/90">{r.medianReadiness}</td>
                  <td
                    className={`data px-4 py-3 text-right ${
                      r.overdue > 0 ? "text-alert" : "text-muted-foreground"
                    }`}
                  >
                    {r.overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}