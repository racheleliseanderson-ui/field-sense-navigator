import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Download, Pause, Play, RotateCcw, Square } from "lucide-react";

import { SiteHeader, SiteFooter } from "@/components/chrome";
import { GradeChip } from "@/components/instrument";
import { destinations, displayName, states } from "@/lib/catalog";
import { coverage, integrity, type ProbeResult } from "@/lib/pipeline";
import {
  downloadText,
  runToCsv,
  useRunManager,
  type RunTarget,
} from "@/lib/run-manager";
import { getLiveConditions } from "@/lib/live.functions";
import { checkSourceUrl } from "@/lib/verify.functions";
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
type StatusFilter = "all" | "matched" | "unmatched" | "error";
type Mode = "station" | "source";

const SCOPE_LABEL: Record<Scope, string> = {
  sample: "Catalog head",
  state: "One state",
  watchlist: "Watchlist",
  compare: "Comparison tray",
};

function Pipeline() {
  const { ids: watched } = useWatchlist();
  const { ids: compared } = useCompareTray();
  const [scope, setScope] = useState<Scope>("sample");
  const [mode, setMode] = useState<Mode>("station");
  const [state, setState] = useState<string>(states[0] ?? "");
  const [limit, setLimit] = useState(12);
  const [concurrency, setConcurrency] = useState(3);
  const [filter, setFilter] = useState<StatusFilter>("all");

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

  const probeStation = useCallback(async (target: RunTarget): Promise<ProbeResult> => {
    try {
      const live = await getLiveConditions({
        data: { state: target.state, waterbody: target.waterbody },
      });
      return {
        id: target.id,
        name: target.name,
        state: target.state,
        status: live.station ? "matched" : "unmatched",
        station: live.station ? `${live.station.agency} ${live.station.id}` : null,
        readings: live.readings.length,
        note: live.station
          ? live.station.name
          : (live.unknowns[0] ?? "No official station publishes under this name."),
      };
    } catch {
      return {
        id: target.id,
        name: target.name,
        state: target.state,
        status: "error",
        station: null,
        readings: 0,
        note: "The agency feed could not be reached on this run. Treat the water as unmonitored.",
      };
    }
  }, []);

  const probeSource = useCallback(async (target: RunTarget): Promise<ProbeResult> => {
    try {
      const v = await checkSourceUrl({ data: { url: target.sourceUrl ?? "" } });
      return {
        id: target.id,
        name: target.name,
        state: target.state,
        status: v.ok ? (v.redirected ? "unmatched" : "matched") : "error",
        station: v.httpStatus ? `HTTP ${v.httpStatus}` : "no answer",
        readings: 0,
        note: v.note,
      };
    } catch {
      return {
        id: target.id,
        name: target.name,
        state: target.state,
        status: "error",
        station: null,
        readings: 0,
        note: "Source verification could not complete on this run. Treat the citation as unverified.",
      };
    }
  }, []);

  const probe = mode === "source" ? probeSource : probeStation;
  const run = useRunManager(probe);
  const modeLabel = mode === "source" ? "Source verification" : "Station resolution";
  const scopeLabel = `${modeLabel} · ${
    scope === "state" ? `${SCOPE_LABEL.state} · ${state}` : SCOPE_LABEL[scope]
  }`;

  const targets = useMemo<RunTarget[]>(
    () =>
      pool
        .filter((d) => Boolean(d))
        .map((d) => ({
          id: d!.id,
          name: displayName(d!),
          state: d!.state,
          waterbody: d!.waterbody,
          sourceUrl: d!.officialSourceUrl,
        })),
    [pool],
  );

  const startRun = () => void run.start(targets, { concurrency, scope: scopeLabel });

  const retryFailures = () => {
    const failed = run.results.filter((r) => r.status === "error");
    const retry = failed
      .map((r) => destinations.find((d) => d.id === r.id))
      .filter((d) => Boolean(d))
      .map((d) => ({
        id: d!.id,
        name: displayName(d!),
        state: d!.state,
        waterbody: d!.waterbody,
        sourceUrl: d!.officialSourceUrl,
      }));
    if (retry.length > 0)
      void run.start(retry, { concurrency, scope: `${scopeLabel} · retry`, append: true });
  };

  const visible = run.results.filter((r) => filter === "all" || r.status === filter);
  const progress =
    run.planned === 0 ? 0 : Math.round((run.counts.probed / run.planned) * 100);
  const busy = run.state === "running" || run.state === "paused";
  const statusLine =
    run.state === "running"
      ? "Running"
      : run.state === "paused"
        ? "Paused — nothing is being probed"
        : run.state === "stopped"
          ? `Stopped — ${run.counts.unreached} target(s) never reached`
          : run.state === "complete"
            ? "Run complete"
            : "Idle";

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

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
          Source verification &amp; station resolution
        </h2>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {mode === "source"
            ? "Each run reads the agency page the record cites and reports what the host returned. A page that has moved is reported as moved; a host that does not answer leaves the citation unverified."
            : "Each run asks the official station index whether a gauge publishes under the water's own name. No nearby station is substituted for a miss."}
        </p>

        <div className="panel mt-6 grid gap-4 p-5 md:grid-cols-[auto_auto_auto_auto_1fr] md:items-end">
          <div>
            <label className="tick text-[0.55rem]" htmlFor="mode">
              Run type
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              disabled={busy}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground disabled:opacity-50 md:w-48"
            >
              <option value="station">Station resolution</option>
              <option value="source">Source verification</option>
            </select>
          </div>
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
                State or province
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
          <div>
            <label className="tick text-[0.55rem]" htmlFor="concurrency">
              Parallel probes
            </label>
            <select
              id="concurrency"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={busy}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground disabled:opacity-50 md:w-32"
            >
              {[1, 3, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={startRun}
              disabled={busy || targets.length === 0}
              className="tap inline-flex min-h-11 items-center gap-2 border border-brass/50 bg-brass/10 px-5 text-xs uppercase tracking-[0.14em] text-brass disabled:opacity-50"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run ({targets.length})
            </button>
            <button
              type="button"
              onClick={run.state === "paused" ? run.resume : run.pause}
              disabled={!busy}
              className="tap inline-flex min-h-11 items-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground disabled:opacity-50"
            >
              <Pause className="h-4 w-4" aria-hidden="true" />
              {run.state === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={run.stop}
              disabled={!busy}
              className="tap inline-flex min-h-11 items-center gap-2 border border-hairline px-5 text-xs uppercase tracking-[0.14em] text-foreground disabled:opacity-50"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop
            </button>
          </div>
        </div>

        <div
          className="mt-4"
          aria-live="polite"
          role="status"
          aria-label="Run progress"
        >
          <div
            className="h-[2px] w-full bg-border/60"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="data mt-2 text-xs text-muted-foreground">
            {statusLine} · {run.counts.probed}/{run.planned || targets.length} probed ·{" "}
            {run.counts.matched} matched · {run.counts.unmatched} unmatched · {run.counts.errors} error
          </p>
        </div>

        {run.results.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["all", "matched", "unmatched", "error"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`tap min-h-11 border px-4 text-[0.65rem] uppercase tracking-[0.14em] ${
                  filter === f
                    ? "border-brass/60 bg-brass/10 text-brass"
                    : "border-hairline text-muted-foreground hover:border-brass/40"
                }`}
              >
                {f}
              </button>
            ))}
            <span className="h-px flex-1 bg-hairline" />
            <button
              type="button"
              onClick={retryFailures}
              disabled={busy || run.counts.errors === 0}
              className="tap inline-flex min-h-11 items-center gap-2 border border-hairline px-4 text-[0.65rem] uppercase tracking-[0.14em] text-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-run failures
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(`pipeline-run-${Date.now()}.csv`, runToCsv(run.results))
              }
              className="tap inline-flex min-h-11 items-center gap-2 border border-hairline px-4 text-[0.65rem] uppercase tracking-[0.14em] text-foreground"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              CSV
            </button>
          </div>
        )}

        {run.results.length > 0 && visible.length === 0 && (
          <p className="mt-6 border border-hairline p-6 text-xs text-muted-foreground">
            No rows in this run carry that status.
          </p>
        )}

        {visible.length > 0 && (
          <ul className="mt-4 divide-y divide-hairline border border-hairline">
            {visible.map((r) => (
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

        {run.history.length > 0 && (
          <div className="mt-8">
            <h3 className="tick text-[0.55rem]">Run history · last {run.history.length}</h3>
            <ul className="data mt-3 divide-y divide-hairline border border-hairline text-xs">
              {run.history.map((h) => (
                <li
                  key={h.id}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="truncate text-foreground/90">
                    {new Date(h.startedAt).toLocaleTimeString()} · {h.scope} · {h.outcome}
                  </span>
                  <span className="text-muted-foreground sm:text-right">
                    {h.probed}/{h.planned} probed · {h.matched} matched · {h.errors} error ·{" "}
                    {(h.durationMs / 1000).toFixed(1)}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
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

      </main>
      <SiteFooter />
    </div>
  );
}