import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, ChevronDown } from "lucide-react";
import { getLiveConditions } from "@/lib/live.functions";
import { consumeQueuedClick } from "@/lib/queued-clicks";
import type { Destination } from "@/lib/catalog";

type PanelReading = {
  label: string;
  value: string;
  unit: string;
  observedAt: string;
};

function ago(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown time";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 365) return `${days} d ago`;
  return `${Math.round(days / 365)} y ago`;
}

function formatAsOf(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatObservedDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  return d.toISOString().slice(0, 10);
}

function sourceLine(source: string, age: number | null, agency: string | null) {
  if (source === "scheduled-snapshot") {
    return `Scheduled ingest · ${age ?? "?"} min old`;
  }
  if (source === "agency-live") {
    return `Live ${agency ?? "agency"} pull · binding used`;
  }
  return null;
}

function ReadingRows({
  readings,
  stationId,
  retained = false,
}: {
  readings: PanelReading[];
  stationId?: string | null | undefined;
  retained?: boolean;
}) {
  return (
    <dl className="mt-3 space-y-3">
      {readings.map((r) => (
        <div
          key={`${r.label}-${r.observedAt}`}
          className={retained ? "border-l border-hairline pl-3" : "border-l border-brass/50 pl-3"}
        >
          <dt className={`tick text-[0.55rem] ${retained ? "text-muted-foreground" : "text-brass"}`}>
            {r.label}
          </dt>
          <dd
            className={`data mt-1 ${retained ? "text-sm text-muted-foreground" : "text-lg text-foreground"}`}
          >
            {r.value}
            {r.unit ? (
              <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>
            ) : null}
          </dd>
          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
            {retained
              ? `observed ${formatObservedDate(r.observedAt)} · ${ago(r.observedAt)}`
              : `as of ${formatAsOf(r.observedAt)} · ${stationId ?? r.label}`}
          </p>
        </div>
      ))}
    </dl>
  );
}

function gaugeEmptyCopy(station: boolean, retainedCount: number) {
  if (station && retainedCount > 0) {
    return "No current official reading. The last agency observation is older than the freshness window and is printed below with its original time.";
  }
  if (station) {
    return "The matched station returned no current values; the feed may be offline.";
  }
  return "No official gauge reading on this record. The pipeline will not invent a nearby station.";
}

/**
 * Same four layers on every water: gauge, observation, forecast, agency-page
 * language. Fetch stays off until the reader asks — raw attributed
 * observations only, never a bite or behaviour forecast.
 */
export function LiveConditions({ destination }: { destination: Destination }) {
  const [open, setOpen] = useState(false);
  const [queuedReplay, setQueuedReplay] = useState(false);
  const queueKey = `live-readings:${destination.id}`;
  const replayed = useRef(false);

  // Replay a "show readings" press that landed before hydration wired the button.
  useEffect(() => {
    if (replayed.current) return;
    if (consumeQueuedClick(queueKey)) {
      replayed.current = true;
      setQueuedReplay(true);
      setOpen(true);
    }
  }, [queueKey]);

  const call = useServerFn(getLiveConditions);
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ["live", destination.id],
    queryFn: () =>
      call({
        data: {
          id: destination.id,
          state: destination.state,
          waterbody: destination.waterbody,
        },
      }),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const retained = data?.retainedReadings ?? [];
  const obsRetained = data?.observation?.retainedReadings ?? [];

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brass" aria-hidden="true" />
          <p className="tick text-brass">Official readings</p>
        </div>
        {open && (
          <button
            type="button"
            onClick={() => {
              if (isFetching) return;
              void refetch();
            }}
            disabled={isFetching}
            aria-label="Refresh official readings"
            className="tap grid h-9 w-9 place-items-center text-muted-foreground hover:text-brass disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {!open && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every record carries the same four layers — gauge, weather
            observation, forecast, and agency-page language. They load only when
            you request them. Raw station observations, never a bite or
            behaviour forecast.
          </p>
          <button
            type="button"
            data-queue-click={queueKey}
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="mt-4 inline-flex min-h-10 items-center gap-2 border border-hairline px-4 text-xs uppercase tracking-[0.12em] text-foreground hover:border-brass/50"
          >
            Show official readings
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <p
            data-queue-notice={queueKey}
            hidden
            aria-live="polite"
            className="mt-3 text-xs uppercase tracking-[0.12em] text-brass"
          >
            Queued — loading official readings…
          </p>
        </div>
      )}

      {open && isLoading && (
        <div className="mt-5 space-y-3" aria-live="polite">
          {queuedReplay && (
            <p className="text-xs uppercase tracking-[0.12em] text-brass">
              Queued — loading official readings…
            </p>
          )}
          <div className="shimmer h-3 w-2/3" />
          <div className="shimmer h-3 w-1/2" />
          <div className="shimmer h-10 w-full" />
        </div>
      )}

      {open && isError && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The official feeds could not be reached. Treat this water as unmonitored
          and verify conditions directly.
        </p>
      )}

      {open && data && (
        <>
          {data.station ? (
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {data.station.agency} station{" "}
              <span className="data text-brass">{data.station.id}</span> —{" "}
              {data.station.name}
              {data.binding.source === "override" ? " · pinned" : ""}
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {data.binding.note}
            </p>
          )}

          {data.source !== "unbound" && (
            <p className="mt-2 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {sourceLine(data.source, data.snapshotAgeMinutes, data.station?.agency ?? null)}
            </p>
          )}

          <div className="mt-5">
            <p className="tick text-[0.55rem] text-brass">Gauge</p>
            {data.readings.length > 0 ? (
              <ReadingRows readings={data.readings} stationId={data.station?.id} />
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {gaugeEmptyCopy(Boolean(data.station), retained.length)}
              </p>
            )}
            {retained.length > 0 && (
              <div className="mt-4">
                <p className="tick text-[0.55rem] text-muted-foreground">
                  Last official observation
                </p>
                <ReadingRows readings={retained} stationId={data.station?.id} retained />
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="tick text-[0.55rem]">Weather observation</p>
            {data.observation &&
            (data.observation.readings.length > 0 || obsRetained.length > 0) ? (
              <>
                <p className="mt-2 text-sm text-foreground">
                  NWS {data.observation.stationId} — {data.observation.stationName}
                </p>
                <p className="mt-1 text-[0.68rem] text-muted-foreground">
                  Bound observation station for this water's published location.
                </p>
                {data.observation.readings.length > 0 ? (
                  <ReadingRows
                    readings={data.observation.readings}
                    stationId={data.observation.stationId}
                  />
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    No current official observation. The last agency observation
                    is printed below with its original time.
                  </p>
                )}
                {obsRetained.length > 0 && (
                  <div className="mt-4">
                    <p className="tick text-[0.55rem] text-muted-foreground">
                      Last official observation
                    </p>
                    <ReadingRows
                      readings={obsRetained}
                      stationId={data.observation.stationId}
                      retained
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No official observation station is bound, or the station is silent.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="tick text-[0.55rem]">Forecast</p>
            {data.forecast ? (
              <>
                <p className="mt-2 tick text-[0.55rem]">
                  NWS {data.forecast.office} · {data.forecast.period}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {data.forecast.detail}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No official forecast was returned for this water's published location.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="tick text-[0.55rem]">
              Agency page language
              {data.closures.scannedAt ? ` · scanned ${ago(data.closures.scannedAt)}` : ""}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {data.closures.note}
            </p>
            {data.closures.hits.map((h) => (
              <p
                key={`${h.term}-${h.snippet}`}
                className="mt-2 border-l border-alert/70 pl-3 text-xs leading-relaxed text-foreground"
              >
                “{h.snippet}”
              </p>
            ))}
          </div>

          <ul className="mt-5 space-y-2">
            {data.unknowns.map((u) => (
              <li
                key={u}
                className="flex gap-3 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 h-px w-4 shrink-0 bg-alert" />
                {u}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
