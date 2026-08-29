import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getLiveConditions, getPipelinePulse } from "@/lib/live.functions";
import { checkSourceUrl } from "@/lib/verify.functions";
import { useCompareTray } from "@/lib/compare-tray";
import { useWatchlist } from "@/lib/watchlist";
import { bindingsFile } from "@/lib/bindings";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "How a decision comes together · Field Sense Navigator" },
      {
        name: "description",
        content:
          "How the catalog is kept honest, where the official numbers come from (USGS, NOAA, Water Survey of Canada, USBR, USACE, CDEC, National Weather Service), and how each water is matched to a gauge.",
      },
      { property: "og:title", content: "How a decision comes together · Field Sense Navigator" },
      {
        property: "og:description",
        content:
          "Where every number on a water record comes from, how often it is refreshed, and what happens when a source has nothing to say. Misses are printed as plainly as hits.",
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
  sample: "First waters in the catalog",
  state: "One state",
  watchlist: "Watchlist",
  compare: "Comparison tray",
};

/** Reader-facing wording for the result filter. Keys stay as-is. */
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All",
  matched: "Matched",
  unmatched: "No match",
  error: "Couldn't reach",
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
  const pulseFn = getPipelinePulse;
  const { data: pulse } = useQuery({
    queryKey: ["pipeline-pulse"],
    queryFn: () => pulseFn(),
    staleTime: 60_000,
  });

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
        data: { id: target.id, state: target.state, waterbody: target.waterbody },
      });
      return {
        id: target.id,
        name: target.name,
        state: target.state,
        status: live.station ? "matched" : "unmatched",
        station: live.station ? `${live.station.agency} ${live.station.id}` : null,
        readings: live.readings.length,
        note: live.station
          ? live.readings.length === 0 && (live.retainedReadings?.length ?? 0) > 0
            ? `${live.station.name} · last official observation older than the window`
            : live.station.name
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
        note: "Couldn't reach the source this time. Treat the water as unmonitored and check the agency page yourself.",
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
        station: v.httpStatus ? "Page answered" : "No answer",
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
        note: "Couldn't finish checking this source. Treat the citation as not verified yet.",
      };
    }
  }, []);

  const probe = mode === "source" ? probeSource : probeStation;
  const run = useRunManager(probe);
  const modeLabel = mode === "source" ? "Official source check" : "Gauge match check";
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
      void run.start(retry, { concurrency, scope: `${scopeLabel} · second try`, append: true });
  };

  const visible = run.results.filter((r) => filter === "all" || r.status === filter);
  const progress =
    run.planned === 0 ? 0 : Math.round((run.counts.probed / run.planned) * 100);
  const busy = run.state === "running" || run.state === "paused";
  const statusLine =
    run.state === "running"
      ? "Checking"
      : run.state === "paused"
        ? "Paused — nothing is being checked"
        : run.state === "stopped"
          ? `Stopped — ${run.counts.unreached} water(s) not checked`
          : run.state === "complete"
            ? "Check complete"
            : "Ready to start";

  const bind = pulse?.bindings ?? bindingsFile.stats;
  const ingest = pulse?.ingest;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="content">

      <section className="border-b border-hairline bg-abyss">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
          <div className="flex items-center gap-4">
            <span className="data text-xs text-brass">HOW IT WORKS</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2rem,5vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.04em] text-foreground">
            How a decision
            <br />
            comes together.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every night, each water is matched to its official gauge (USGS,
            NOAA CO-OPS, Water Survey of Canada, USBR, USACE, CA DWR CDEC),
            placed on the map, given a weather station, and its agency page is
            read for closure wording. Western and coastal gauges refresh every
            10 minutes; the whole catalog every 30. A slow agency cannot hold up
            the others. Where a match cannot be made, we say so — misses are
            never quietly dropped.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { k: "Records", v: destinations.length },
              { k: "Jurisdictions", v: rows.length },
              { k: "Quality checks", v: checks.length },
              { k: "Needing attention", v: checks.filter((c) => c.severity === "flagged").length },
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
          Where the numbers come from
        </h2>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Gauge matches are settled in advance and held on file, so every water
          gets the same four reads — where it is, its gauge, its weather
          station, and the wording on its agency page. Numbers come from the
          most recent scheduled refresh, or straight from the agency if that is
          more than 45 minutes old. A silent source is recorded as a miss, never
          skipped over. What decides whether a number counts as current is when
          it was observed, not when we collected it — 48 hours for level, flow
          and weather, 7 days for reservoir elevation. Older official values are
          still shown, with the time they were actually taken.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          <li className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base font-bold text-foreground">Gauge matching</p>
              <GradeChip grade="clear" label="Nightly" />
            </div>
            <p className="data mt-3 text-sm text-foreground">
              {bind.located ?? 0}/{bind.records ?? destinations.length} placed on the map · {bind.nwsBound ?? 0} weather stations
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Gauges {bind.matched} matched · {bind.unmatched} with no official gauge
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              USGS {bind.byAgency?.USGS ?? 0} · NOAA {bind.byAgency?.["NOAA-COOPS"] ?? 0} · WSC{" "}
              {bind.byAgency?.WSC ?? 0} · USBR {bind.byAgency?.USBR ?? 0} · USACE{" "}
              {bind.byAgency?.USACE ?? 0} · CDEC {bind.byAgency?.CDEC ?? 0}
              {bind.overrides ? ` · ${bind.overrides} pinned` : ""}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Last matched {pulse?.bindings.generatedAt
                ? new Date(pulse.bindings.generatedAt).toUTCString()
                : new Date(bindingsFile.generatedAt).toUTCString()}
              . A gauge pinned by hand always wins. The published name and the
              water type must both agree, and a nearby gauge is never
              substituted for the right one.
            </p>
          </li>
          <li className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base font-bold text-foreground">Scheduled refresh</p>
              <GradeChip
                grade={!ingest || ingest.stale ? "watch" : ingest.degraded ? "watch" : "clear"}
                label={
                  !ingest
                    ? "Not refreshed yet"
                    : ingest.stale
                      ? "Out of date"
                      : ingest.degraded
                        ? "Partial"
                        : "Current"
                }
              />
            </div>
            <p className="data mt-3 text-sm text-foreground">
              {ingest
                ? `${ingest.withReadings}/${ingest.boundStations} gauges with current readings`
                : "No refresh has run yet"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Weather observations {ingest?.nwsWithObs ?? 0}/{ingest?.nwsStations ?? 0}
              {(ingest?.withStaleOnly ?? 0) > 0
                ? ` · ${ingest!.withStaleOnly} showing an older official reading instead`
                : ""}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Refreshed every {ingest?.criticalCadenceMinutes ?? 10} min for the
              fastest-moving waters · every {ingest?.fullCadenceMinutes ?? 30} min
              for the whole catalog
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Bureau of Reclamation {ingest?.usbr?.withReadings ?? 0}/{ingest?.usbr?.bound ?? 0} with readings
              {ingest?.usbr?.timeouts
                ? ` · ${ingest.usbr.timeouts} did not answer in time`
                : ""}
              . Read separately, so a slow answer here cannot hold up USGS or NOAA.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {ingest?.ingestedAt
                ? `Last refreshed ${ingest.ageMinutes} min ago · the past ${ingest.archiveRetentionHours ?? 24} hours are kept`
                : "The scheduled refresh has not run yet."}
            </p>
            {(ingest?.errorCount ?? 0) > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {ingest!.errorCount} source{ingest!.errorCount === 1 ? "" : "s"} did not answer
                {ingest!.hardErrorCount
                  ? ` · ${ingest!.hardErrorCount} with no earlier official value to fall back on`
                  : " · the last official value is shown where one exists"}
                . The time it was taken is always printed.
              </p>
            )}
          </li>
          <li className="panel p-5 md:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base font-bold text-foreground">
                Agency-page closure language
              </p>
              <GradeChip
                grade={!pulse?.closures || pulse.closures.stale ? "watch" : "clear"}
                label={!pulse?.closures?.scannedAt ? "Not read yet" : pulse.closures.stale ? "Out of date" : "Current"}
              />
            </div>
            <p className="data mt-3 text-sm text-foreground">
              {pulse?.closures
                ? `${pulse.closures.hit} pages with closure language · ${pulse.closures.none} none · ${pulse.closures.unreachable} unread`
                : "Agency pages have not been read yet"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {pulse?.closures?.scannedAt
                ? `Last read ${pulse.closures.scanAgeMinutes} min ago · nightly. A match is wording found on the agency page, not a ruling that the water is closed.`
                : "The nightly read of agency pages has not run yet."}
            </p>
          </li>
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          How the catalog is kept honest
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
                  label={c.severity === "clear" ? "Clear" : c.severity === "watch" ? "Watch" : "Needs attention"}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
              <p className="data mt-3 text-sm text-foreground">
                {c.total - c.count}/{c.total} records clear
              </p>
              {c.examples.length > 0 && (
                <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                  Records to fix: {c.examples.join(", ")}
                  {c.count > c.examples.length ? ` +${c.count - c.examples.length} more` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Check a source or a gauge match yourself
        </h2>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {mode === "source"
            ? "Each check opens the agency page a record cites and reports what came back. A page that has moved is reported as moved; a page that does not answer leaves the citation not verified yet."
            : "Water records always use the nightly gauge match. This is here for spot-checking a handful of waters yourself, not for the scheduled work."}
        </p>

        <div className="panel mt-6 grid gap-4 p-5 md:grid-cols-[auto_auto_auto_auto_1fr] md:items-end">
          <div>
            <label className="tick text-[0.55rem]" htmlFor="mode">
              What to check
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              disabled={busy}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground disabled:opacity-50 md:w-48"
            >
              <option value="station">Gauge match</option>
              <option value="source">Official source page</option>
            </select>
          </div>
          <div>
            <label className="tick text-[0.55rem]" htmlFor="scope">
              Which waters
            </label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="tap mt-2 h-11 w-full border border-hairline bg-background px-3 text-sm text-foreground md:w-48"
            >
              <option value="sample">First waters in the catalog</option>
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
              How many
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
              Checks at a time
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
              Check ({targets.length})
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
          aria-label="Check progress"
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
            {statusLine} · {run.counts.probed}/{run.planned || targets.length} checked ·{" "}
            {mode === "source"
              ? `${run.counts.matched} verified · ${run.counts.unmatched} moved · ${run.counts.errors} not verified`
              : `${run.counts.matched} matched · ${run.counts.unmatched} no match · ${run.counts.errors} couldn't reach`}
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
                {STATUS_FILTER_LABEL[f]}
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
              Try the misses again
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
            Nothing in this check has that result.
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
                    {mode === "source"
                      ? (r.station ?? "No answer")
                      : `${r.station ?? "No gauge matched"} · ${r.readings} readings`}
                  </span>
                  <GradeChip
                    grade={r.status === "matched" ? "clear" : r.status === "unmatched" ? "watch" : "flagged"}
                    label={
                      mode === "source"
                        ? r.status === "matched"
                          ? "Verified"
                          : r.status === "unmatched"
                            ? "Moved"
                            : "Not verified yet"
                        : r.status === "matched"
                          ? "Matched"
                          : r.status === "unmatched"
                            ? "No match"
                            : "Couldn't reach"
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {run.history.length > 0 && (
          <div className="mt-8">
            <h3 className="tick text-[0.55rem]">Recent checks · last {run.history.length}</h3>
            <ul className="data mt-3 divide-y divide-hairline border border-hairline text-xs">
              {run.history.map((h) => (
                <li
                  key={h.id}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="truncate text-foreground/90">
                    {new Date(h.startedAt).toLocaleTimeString()} · {h.scope} ·{" "}
                    {h.outcome === "complete" ? "finished" : "stopped early"}
                  </span>
                  <span className="text-muted-foreground sm:text-right">
                    {h.probed}/{h.planned} checked · {h.matched} matched · {h.errors} unreachable ·{" "}
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
          Jurisdiction coverage
        </h2>
        <div className="mt-6 overflow-x-auto border border-hairline">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="tick px-4 py-3 text-left text-[0.55rem]">State</th>
                <th scope="col" className="tick px-4 py-3 text-right text-[0.55rem]">Waters</th>
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
