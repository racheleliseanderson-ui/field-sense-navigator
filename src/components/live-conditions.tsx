import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw } from "lucide-react";
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

/** Official gauge and forecast readings, or an explicit statement that none exist. */
export function LiveConditions({ destination }: { destination: Destination }) {
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
      </div>

      {isLoading && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className="shimmer h-3 w-2/3" />
          <div className="shimmer h-3 w-1/2" />
          <div className="shimmer h-10 w-full" />
        </div>
      )}

      {isError && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The official feeds could not be reached. Treat this water as unmonitored
          and verify conditions directly.
        </p>
      )}

      {data && (
        <>
          {data.station ? (
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {data.station.agency} station{" "}
              <span className="data text-brass">{data.station.id}</span> —{" "}
              {data.station.name}
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {data.binding.note}
            </p>
          )}

          {data.source !== "unbound" && (
            <p className="mt-2 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {data.source === "scheduled-snapshot"
                ? `Scheduled ingest · ${data.snapshotAgeMinutes ?? "?"} min old`
                : "Live USGS pull · binding used"}
            </p>
          )}

          {data.readings.length > 0 && (
            <dl className="mt-5 space-y-3">
              {data.readings.map((r) => (
                <div key={r.label} className="border-l border-brass/50 pl-3">
                  <dt className="tick text-[0.55rem] text-brass">{r.label}</dt>
                  <dd className="data mt-1 text-lg text-foreground">
                    {r.value}
                    <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>
                  </dd>
                  <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                    Observed {ago(r.observedAt)}
                  </p>
                </div>
              ))}
            </dl>
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
