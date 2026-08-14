import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, ChevronDown } from "lucide-react";
import { getLiveConditions } from "@/lib/live.functions";
import type { Destination } from "@/lib/catalog";

function ago(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown time";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

function formatAsOf(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

/**
 * Official sensor context. OFF by default — fetch only after explicit opt-in.
 * Raw attributed observations only. Never a bite or behaviour forecast.
 */
export function LiveConditions({ destination }: { destination: Destination }) {
  const [open, setOpen] = useState(false);
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
            onClick={() => void refetch()}
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
            Live gauge, water level and wind readings are available only when you
            request them. They are raw station observations, never a bite or
            behaviour forecast.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex min-h-10 items-center gap-2 border border-hairline px-4 text-xs uppercase tracking-[0.12em] text-foreground hover:border-brass/50"
          >
            Show official readings
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {open && isLoading && (
        <div className="mt-5 space-y-3" aria-live="polite">
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
              {sourceLine(data.source, data.snapshotAgeMinutes, data.station?.agency)}
            </p>
          )}

          {data.readings.length > 0 && (
            <dl className="mt-5 space-y-3">
              {data.readings.map((r) => (
                <div key={r.label} className="border-l border-brass/50 pl-3">
                  <dt className="tick text-[0.55rem] text-brass">{r.label}</dt>
                  <dd className="data mt-1 text-lg text-foreground">
                    {r.value}
                    {r.unit ? (
                      <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>
                    ) : null}
                  </dd>
                  <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                    as of {formatAsOf(r.observedAt)} · {data.station?.id ?? r.label}
                  </p>
                </div>
              ))}
            </dl>
          )}

          {data.observation && data.observation.readings.length > 0 && (
            <div className="mt-5 border-t border-hairline pt-4">
              <p className="tick text-[0.55rem]">
                NWS {data.observation.stationId} · {data.observation.stationName}
              </p>
              <p className="mt-1 text-[0.68rem] text-muted-foreground">
                Bound observation station — not a guess, not the ramp unless the
                names agree.
              </p>
              <dl className="mt-3 space-y-2">
                {data.observation.readings.map((r) => (
                  <div key={r.label}>
                    <dt className="tick text-[0.55rem] text-brass">{r.label}</dt>
                    <dd className="data mt-0.5 text-sm text-foreground">
                      {r.value}
                      {r.unit ? (
                        <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {data.forecast && (
            <div className="mt-5 border-t border-hairline pt-4">
              <p className="tick text-[0.55rem]">
                NWS {data.forecast.office} · {data.forecast.period}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {data.forecast.detail}
              </p>
            </div>
          )}

          {data.closures.status !== "unscanned" && (
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
          )}

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
